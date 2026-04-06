import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge';
import { GrizzlEApi, GrizzlEStation } from './grizzlEApi';
import { GrizzlEChargerAccessory } from './platformAccessory';

export const PLATFORM_NAME = 'GrizzlE';
export const PLUGIN_NAME = 'homebridge-grizzl-e';

export class GrizzlEPlatform implements DynamicPlatformPlugin {
  private readonly grizzlApi: GrizzlEApi;
  private readonly cachedAccessories: PlatformAccessory[] = [];
  private readonly chargerAccessories = new Map<string, GrizzlEChargerAccessory>();
  private readonly pollInterval: number;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly homebridgeApi: API,
  ) {
    this.pollInterval = (config['pollInterval'] as number | undefined) ?? 30;

    this.grizzlApi = new GrizzlEApi(
      config['email'] as string,
      config['password'] as string,
      log,
    );

    this.homebridgeApi.on('didFinishLaunching', () => {
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.debug(`Restoring cached accessory: ${accessory.displayName}`);
    this.cachedAccessories.push(accessory);
  }

  private async discoverDevices(): Promise<void> {
    let stations: GrizzlEStation[];
    try {
      stations = await this.grizzlApi.getStations();
    } catch (err) {
      this.log.error(`Failed to fetch Grizzl-E stations: ${err}`);
      return;
    }

    this.log.info(`Found ${stations.length} Grizzl-E station(s)`);

    const discoveredUUIDs = new Set<string>();

    for (const station of stations) {
      const uuid = this.homebridgeApi.hap.uuid.generate(station.id);
      discoveredUUIDs.add(uuid);

      const existingAccessory = this.cachedAccessories.find((a) => a.UUID === uuid);

      if (existingAccessory) {
        this.log.info(`Restoring charger: ${existingAccessory.displayName} (${station.serialNumber})`);
        existingAccessory.context['station'] = station;
        this.homebridgeApi.updatePlatformAccessories([existingAccessory]);
        this.chargerAccessories.set(uuid, new GrizzlEChargerAccessory(
          this.homebridgeApi.hap, this.log, existingAccessory, this.grizzlApi, station,
        ));
      } else {
        const name = station.identity || station.serialNumber || station.id;
        this.log.info(`Adding new charger: ${name} (${station.serialNumber})`);
        const accessory = new this.homebridgeApi.platformAccessory(name, uuid);
        accessory.context['station'] = station;
        this.chargerAccessories.set(uuid, new GrizzlEChargerAccessory(
          this.homebridgeApi.hap, this.log, accessory, this.grizzlApi, station,
        ));
        this.homebridgeApi.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }

    // Remove accessories no longer in the account
    const staleAccessories = this.cachedAccessories.filter((a) => !discoveredUUIDs.has(a.UUID));
    if (staleAccessories.length > 0) {
      this.log.info(`Removing ${staleAccessories.length} stale accessory(s)`);
      for (const stale of staleAccessories) {
        this.chargerAccessories.delete(stale.UUID);
      }
      this.homebridgeApi.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories);
    }

    // Single poll loop for all chargers using getStations()
    setInterval(() => this.pollStations(), this.pollInterval * 1000);
  }

  private async pollStations(): Promise<void> {
    let stations: GrizzlEStation[];
    try {
      stations = await this.grizzlApi.getStations();
    } catch (err) {
      this.log.error(`Poll failed: ${err}`);
      return;
    }
    for (const station of stations) {
      const uuid = this.homebridgeApi.hap.uuid.generate(station.id);
      this.chargerAccessories.get(uuid)?.updateStation(station);
    }
  }
}
