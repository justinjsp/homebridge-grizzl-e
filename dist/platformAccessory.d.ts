import { PlatformAccessory, Logger, HAP } from 'homebridge';
import { GrizzlEApi, GrizzlEStation } from './grizzlEApi';
export declare class GrizzlEChargerAccessory {
    private readonly hap;
    private readonly log;
    private readonly accessory;
    private readonly api;
    private readonly outletService;
    private readonly carPluggedInService;
    private readonly statusServices;
    private station;
    constructor(hap: HAP, log: Logger, accessory: PlatformAccessory, api: GrizzlEApi, initialStation: GrizzlEStation);
    private connectorStatus;
    private isEnabled;
    private isCharging;
    private isFaulted;
    private isCarConnected;
    private assertOnline;
    private occupancy;
    private getOn;
    private setOn;
    private getOutletInUse;
    private getStatusFault;
    private getCarPluggedIn;
    private getStatusOccupancy;
    updateStation(station: GrizzlEStation): void;
}
//# sourceMappingURL=platformAccessory.d.ts.map