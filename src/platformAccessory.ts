import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  Logger,
  HAP,
} from 'homebridge';
import { GrizzlEApi, GrizzlEStation } from './grizzlEApi';

// Station/connector mode values used by the Grizzl-E Connect API
// Modes/statuses that mean the user has disabled charging (not temporary EVSE suspensions)
const DISABLED_MODES = new Set(['Inactive', 'Unavailable']);
// OCPP statuses that indicate a car is physically plugged in
const CAR_CONNECTED_STATUSES = new Set(['Preparing', 'Charging', 'SuspendedEVSE', 'SuspendedEV', 'Finishing']);

// Individual OCPP status sensors shown on the accessory detail page
const STATUS_SENSORS: Array<{ status: string; name: string; subtype: string }> = [
  { status: 'Preparing',     name: 'Preparing',            subtype: 'status-preparing' },
  { status: 'Charging',      name: 'Charging',             subtype: 'status-charging' },
  { status: 'SuspendedEVSE', name: 'Suspended by Charger', subtype: 'status-suspended-evse' },
  { status: 'SuspendedEV',   name: 'Suspended by Car',     subtype: 'status-suspended-ev' },
  { status: 'Finishing',     name: 'Finishing',            subtype: 'status-finishing' },
];

export class GrizzlEChargerAccessory {
  private readonly outletService: Service;
  private readonly carPluggedInService: Service;
  private readonly statusServices: Map<string, Service> = new Map(); // subtype → service
  private station: GrizzlEStation;

  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly accessory: PlatformAccessory,
    private readonly api: GrizzlEApi,
    initialStation: GrizzlEStation,
  ) {
    this.station = initialStation;

    // Set accessory information
    const infoService = this.accessory.getService(this.hap.Service.AccessoryInformation)!;
    infoService
      .setCharacteristic(this.hap.Characteristic.Manufacturer, 'United Chargers / Grizzl-E')
      .setCharacteristic(this.hap.Characteristic.Model, 'Connect')
      .setCharacteristic(this.hap.Characteristic.SerialNumber, initialStation.serialNumber || initialStation.id);

    // Outlet service — On = charging enabled, OutletInUse = actively charging
    this.outletService =
      this.accessory.getService(this.hap.Service.Outlet) ||
      this.accessory.addService(this.hap.Service.Outlet);

    this.outletService.setPrimaryService(true);
    this.outletService.setCharacteristic(this.hap.Characteristic.Name, accessory.displayName);
    this.outletService.setCharacteristic(this.hap.Characteristic.ConfiguredName, accessory.displayName);

    this.outletService
      .getCharacteristic(this.hap.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    this.outletService
      .getCharacteristic(this.hap.Characteristic.OutletInUse)
      .onGet(this.getOutletInUse.bind(this));

    // StatusFault — shows a warning badge on the outlet tile when the charger reports a fault
    this.outletService
      .getCharacteristic(this.hap.Characteristic.StatusFault)
      .onGet(this.getStatusFault.bind(this));

    // Remove stale ContactSensor service left over from a previous version
    const staleContactSensor = this.accessory.getService(this.hap.Service.ContactSensor);
    if (staleContactSensor) {
      this.accessory.removeService(staleContactSensor);
    }

    // "Car Plugged In" — aggregate sensor, true whenever any connector has a car attached
    this.carPluggedInService =
      this.accessory.getServiceById(this.hap.Service.OccupancySensor, 'car-plugged-in') ||
      this.accessory.addService(this.hap.Service.OccupancySensor, 'Car Plugged In', 'car-plugged-in');

    this.carPluggedInService.setCharacteristic(this.hap.Characteristic.Name, 'Car Plugged In');
    this.carPluggedInService.setCharacteristic(this.hap.Characteristic.ConfiguredName, 'Car Plugged In');
    this.outletService.addLinkedService(this.carPluggedInService);

    this.carPluggedInService
      .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
      .onGet(this.getCarPluggedIn.bind(this));

    // Individual OCPP status sensors
    for (const { status, name, subtype } of STATUS_SENSORS) {
      const svc =
        this.accessory.getServiceById(this.hap.Service.OccupancySensor, subtype) ||
        this.accessory.addService(this.hap.Service.OccupancySensor, name, subtype);

      svc.setCharacteristic(this.hap.Characteristic.Name, name);
      svc.setCharacteristic(this.hap.Characteristic.ConfiguredName, name);
      this.outletService.addLinkedService(svc);

      svc
        .getCharacteristic(this.hap.Characteristic.OccupancyDetected)
        .onGet(() => this.getStatusOccupancy(status));

      this.statusServices.set(subtype, svc);
    }
  }

  private connectorStatus(station: GrizzlEStation): string {
    if (station.connectors.length > 0) {
      // Return the most active connector status
      for (const preferred of ['Charging', 'Preparing', 'SuspendedEVSE', 'SuspendedEV', 'Finishing']) {
        if (station.connectors.some((c) => c.status === preferred)) return preferred;
      }
      return station.connectors[0].status;
    }
    return station.status;
  }

  private isEnabled(station: GrizzlEStation): boolean {
    if (DISABLED_MODES.has(station.mode)) return false;
    if (station.connectors.length > 0) return !DISABLED_MODES.has(station.connectors[0].status);
    return !DISABLED_MODES.has(station.status);
  }

  private isCharging(station: GrizzlEStation): boolean {
    if (station.connectors.length > 0) return station.connectors.some((c) => c.status === 'Charging');
    return station.status === 'Charging';
  }

  private isFaulted(station: GrizzlEStation): boolean {
    if (station.connectors.length > 0) {
      return station.connectors.some(
        (c) => c.status === 'Faulted' || (c.errorCode && c.errorCode !== 'NoError'),
      );
    }
    return station.status === 'Faulted' || (!!station.errorCode && station.errorCode !== 'NoError');
  }

  private isCarConnected(station: GrizzlEStation): boolean {
    if (station.connectors.length > 0) return station.connectors.some((c) => CAR_CONNECTED_STATUSES.has(c.status));
    return CAR_CONNECTED_STATUSES.has(station.status);
  }

  private assertOnline(): void {
    if (this.station.online === false) {
      throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  private occupancy(active: boolean): CharacteristicValue {
    return active
      ? this.hap.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
      : this.hap.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;
  }

  private getOn(): CharacteristicValue {
    this.assertOnline();
    return this.isEnabled(this.station);
  }

  private async setOn(value: CharacteristicValue): Promise<void> {
    this.assertOnline();
    const enabled = value as boolean;
    this.log.info(`[${this.accessory.displayName}] Setting charging ${enabled ? 'enabled' : 'disabled'}`);
    try {
      if (enabled) {
        await this.api.setStationEnabled(this.station.id);
      } else {
        await this.api.setStationDisabled(this.station.id);
      }
      this.station = { ...this.station, mode: enabled ? 'Active' : 'Inactive' };
    } catch (err) {
      this.log.error(`[${this.accessory.displayName}] Failed to set charging state: ${err}`);
      throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  private getOutletInUse(): CharacteristicValue {
    this.assertOnline();
    return this.isCharging(this.station);
  }

  private getStatusFault(): CharacteristicValue {
    this.assertOnline();
    return this.isFaulted(this.station)
      ? this.hap.Characteristic.StatusFault.GENERAL_FAULT
      : this.hap.Characteristic.StatusFault.NO_FAULT;
  }

  private getCarPluggedIn(): CharacteristicValue {
    this.assertOnline();
    return this.occupancy(this.isCarConnected(this.station));
  }

  private getStatusOccupancy(status: string): CharacteristicValue {
    this.assertOnline();
    return this.occupancy(this.connectorStatus(this.station) === status);
  }

  updateStation(station: GrizzlEStation): void {
    const wasOnline = this.station.online;
    const wasEnabled = this.isEnabled(this.station);
    const wasCharging = this.isCharging(this.station);
    const wasFaulted = this.isFaulted(this.station);
    const wasCarConnected = this.isCarConnected(this.station);
    const wasStatus = this.connectorStatus(this.station);
    this.station = station;

    if (station.online !== wasOnline) {
      this.log.info(`[${this.accessory.displayName}] ${station.online ? 'Online' : 'Offline'}`);
      if (!station.online) return;
    }
    if (!station.online) return;

    const nowEnabled = this.isEnabled(station);
    const nowCharging = this.isCharging(station);
    const nowFaulted = this.isFaulted(station);
    const nowCarConnected = this.isCarConnected(station);
    const nowStatus = this.connectorStatus(station);

    if (nowEnabled !== wasEnabled) {
      this.outletService.updateCharacteristic(this.hap.Characteristic.On, nowEnabled);
    }
    if (nowCharging !== wasCharging) {
      this.outletService.updateCharacteristic(this.hap.Characteristic.OutletInUse, nowCharging);
    }
    if (nowFaulted !== wasFaulted) {
      this.log.info(`[${this.accessory.displayName}] Fault ${nowFaulted ? 'detected' : 'cleared'}`);
      this.outletService.updateCharacteristic(
        this.hap.Characteristic.StatusFault,
        nowFaulted ? this.hap.Characteristic.StatusFault.GENERAL_FAULT : this.hap.Characteristic.StatusFault.NO_FAULT,
      );
    }
    if (nowCarConnected !== wasCarConnected) {
      this.log.info(`[${this.accessory.displayName}] Car ${nowCarConnected ? 'plugged in' : 'unplugged'}`);
      this.carPluggedInService.updateCharacteristic(
        this.hap.Characteristic.OccupancyDetected,
        this.occupancy(nowCarConnected),
      );
    }
    if (nowStatus !== wasStatus) {
      this.log.info(`[${this.accessory.displayName}] Status: ${nowStatus}`);
      for (const { status, subtype } of STATUS_SENSORS) {
        const svc = this.statusServices.get(subtype);
        if (svc) {
          svc.updateCharacteristic(
            this.hap.Characteristic.OccupancyDetected,
            this.occupancy(nowStatus === status),
          );
        }
      }
    }
  }
}
