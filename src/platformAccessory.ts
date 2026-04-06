import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  Logger,
  HAP,
} from 'homebridge';
import { GrizzlEApi, GrizzlEStation } from './grizzlEApi';

// Station/connector mode values used by the Grizzl-E Connect API
const DISABLED_MODES = new Set(['Inactive', 'SuspendedEVSE', 'Unavailable']);
const CHARGING_STATUS = 'Charging';

export class GrizzlEChargerAccessory {
  private readonly service: Service;
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

    // Use Outlet service — On = charging enabled, OutletInUse = actively charging
    this.service =
      this.accessory.getService(this.hap.Service.Outlet) ||
      this.accessory.addService(this.hap.Service.Outlet);

    this.service.setCharacteristic(this.hap.Characteristic.Name, accessory.displayName);

    this.service
      .getCharacteristic(this.hap.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    this.service
      .getCharacteristic(this.hap.Characteristic.OutletInUse)
      .onGet(this.getOutletInUse.bind(this));
  }

  private isEnabled(station: GrizzlEStation): boolean {
    // Station-level mode takes precedence (set via POST /mode)
    if (DISABLED_MODES.has(station.mode)) {
      return false;
    }
    if (station.connectors.length > 0) {
      return !DISABLED_MODES.has(station.connectors[0].status);
    }
    return !DISABLED_MODES.has(station.status);
  }

  private isCharging(station: GrizzlEStation): boolean {
    if (station.connectors.length > 0) {
      return station.connectors.some((c) => c.status === CHARGING_STATUS);
    }
    return station.status === CHARGING_STATUS;
  }

  private assertOnline(): void {
    if (this.station.online === false) {
      throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
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
      // Optimistically update local mode so state reflects immediately without waiting for next poll
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

  updateStation(station: GrizzlEStation): void {
    const wasOnline = this.station.online;
    const wasEnabled = this.isEnabled(this.station);
    const wasCharging = this.isCharging(this.station);
    this.station = station;

    if (station.online !== wasOnline) {
      this.log.info(`[${this.accessory.displayName}] ${station.online ? 'Online' : 'Offline'}`);
      // When going offline, Home will show "No Response" on next get via assertOnline()
      if (!station.online) {
        return;
      }
    }

    if (!station.online) {
      return;
    }

    const nowEnabled = this.isEnabled(station);
    const nowCharging = this.isCharging(station);

    if (nowEnabled !== wasEnabled) {
      this.service.updateCharacteristic(this.hap.Characteristic.On, nowEnabled);
    }
    if (nowCharging !== wasCharging) {
      this.service.updateCharacteristic(this.hap.Characteristic.OutletInUse, nowCharging);
    }
  }
}
