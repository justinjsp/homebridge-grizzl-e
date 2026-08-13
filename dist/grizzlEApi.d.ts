export interface GrizzlEConnector {
    id: number;
    type: string;
    status: string;
    power: number;
    maxPower: number;
    errorCode: string;
}
export interface GrizzlEStation {
    id: string;
    identity: string;
    serialNumber: string;
    online: boolean;
    mode: string;
    status: string;
    errorCode: string;
    connectors: GrizzlEConnector[];
    currency: string;
    priceKW: number;
}
export declare class GrizzlEApi {
    private readonly email;
    private readonly password;
    private readonly log;
    private token;
    private tokenExpiry;
    private loginInFlight;
    constructor(email: string, password: string, log: {
        error: (msg: string) => void;
        debug: (msg: string) => void;
    });
    private ensureToken;
    private login;
    private authHeaders;
    getStations(): Promise<GrizzlEStation[]>;
    getStation(id: string): Promise<GrizzlEStation>;
    /**
     * Enable charging on a station.
     *
     * NOTE: Endpoint not yet confirmed via traffic capture. Update once verified
     * by intercepting the Grizzl-E Connect app (e.g. with mitmproxy).
     *
     * Candidates to try:
     *   POST  /client/stations/{id}/enable
     *   PATCH /client/stations/{id}  body: { mode: 'Normal' }
     *   POST  /client/stations/{id}/change-availability  body: { type: 'Operative' }
     */
    setStationEnabled(id: string): Promise<void>;
    setStationDisabled(id: string): Promise<void>;
}
//# sourceMappingURL=grizzlEApi.d.ts.map