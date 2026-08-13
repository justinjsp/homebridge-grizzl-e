import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
export declare const PLATFORM_NAME = "GrizzlE";
export declare const PLUGIN_NAME = "homebridge-grizzl-e";
export declare class GrizzlEPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: PlatformConfig;
    readonly homebridgeApi: API;
    private readonly grizzlApi;
    private readonly cachedAccessories;
    private readonly chargerAccessories;
    private readonly pollInterval;
    constructor(log: Logger, config: PlatformConfig, homebridgeApi: API);
    configureAccessory(accessory: PlatformAccessory): void;
    private discoverDevices;
    private pollStations;
}
//# sourceMappingURL=platform.d.ts.map