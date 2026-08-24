"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrizzlEPlatform = exports.PLUGIN_NAME = exports.PLATFORM_NAME = void 0;
const grizzlEApi_1 = require("./grizzlEApi");
const platformAccessory_1 = require("./platformAccessory");
exports.PLATFORM_NAME = 'GrizzlE';
exports.PLUGIN_NAME = 'homebridge-grizzl-e';
class GrizzlEPlatform {
    constructor(log, config, homebridgeApi) {
        this.log = log;
        this.config = config;
        this.homebridgeApi = homebridgeApi;
        this.cachedAccessories = [];
        this.chargerAccessories = new Map();
        this.pollInterval = config['pollInterval'] ?? 30;
        this.grizzlApi = new grizzlEApi_1.GrizzlEApi(config['email'], config['password'], log);
        if (!config['email'] || !config['password']) {
            this.log.error('Missing required configuration: "email" and "password". ' +
                'The Grizzl-E platform will not start until these are set.');
            return;
        }
        this.homebridgeApi.on('didFinishLaunching', () => {
            this.discoverDevices().catch((err) => this.log.error(`Startup failed: ${err}`));
        });
    }
    configureAccessory(accessory) {
        this.log.debug(`Restoring cached accessory: ${accessory.displayName}`);
        this.cachedAccessories.push(accessory);
    }
    async discoverDevices() {
        let stations;
        try {
            stations = await this.grizzlApi.getStations();
        }
        catch (err) {
            this.log.error(`Failed to fetch Grizzl-E stations: ${err}`);
            return;
        }
        this.log.info(`Found ${stations.length} Grizzl-E station(s)`);
        const discoveredUUIDs = new Set();
        for (const station of stations) {
            const uuid = this.homebridgeApi.hap.uuid.generate(station.id);
            discoveredUUIDs.add(uuid);
            const existingAccessory = this.cachedAccessories.find((a) => a.UUID === uuid);
            if (existingAccessory) {
                this.log.info(`Restoring charger: ${existingAccessory.displayName} (${station.serialNumber})`);
                existingAccessory.context['station'] = station;
                this.homebridgeApi.updatePlatformAccessories([existingAccessory]);
                this.chargerAccessories.set(uuid, new platformAccessory_1.GrizzlEChargerAccessory(this.homebridgeApi.hap, this.log, existingAccessory, this.grizzlApi, station));
            }
            else {
                const name = station.identity || station.serialNumber || station.id;
                this.log.info(`Adding new charger: ${name} (${station.serialNumber})`);
                const accessory = new this.homebridgeApi.platformAccessory(name, uuid);
                accessory.context['station'] = station;
                this.chargerAccessories.set(uuid, new platformAccessory_1.GrizzlEChargerAccessory(this.homebridgeApi.hap, this.log, accessory, this.grizzlApi, station));
                this.homebridgeApi.registerPlatformAccessories(exports.PLUGIN_NAME, exports.PLATFORM_NAME, [accessory]);
            }
        }
        // Remove accessories no longer in the account
        const staleAccessories = this.cachedAccessories.filter((a) => !discoveredUUIDs.has(a.UUID));
        if (staleAccessories.length > 0) {
            this.log.info(`Removing ${staleAccessories.length} stale accessory(s)`);
            for (const stale of staleAccessories) {
                this.chargerAccessories.delete(stale.UUID);
            }
            this.homebridgeApi.unregisterPlatformAccessories(exports.PLUGIN_NAME, exports.PLATFORM_NAME, staleAccessories);
        }
        // Single poll loop for all chargers using getStations()
        setInterval(() => this.pollStations(), this.pollInterval * 1000);
    }
    async pollStations() {
        let stations;
        try {
            stations = await this.grizzlApi.getStations();
        }
        catch (err) {
            this.log.error(`Poll failed: ${err}`);
            return;
        }
        for (const station of stations) {
            const uuid = this.homebridgeApi.hap.uuid.generate(station.id);
            this.chargerAccessories.get(uuid)?.updateStation(station);
        }
    }
}
exports.GrizzlEPlatform = GrizzlEPlatform;
//# sourceMappingURL=platform.js.map