"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrizzlEApi = void 0;
const https = __importStar(require("https"));
const API_BASE = 'connect-api.unitedchargers.com';
// Headers captured from the Grizzl-E Connect iOS app
const APP_HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'GrizzlEConnect/115 CFNetwork/3826.500.131 Darwin/24.5.0',
    'x-app-client': 'Apple, iPad14,3, iPadOS 18.5',
    'x-app-version': 'v0.9.2 (115)',
    'x-application-name': 'Grizzl-E Connect',
};
/**
 * Redacts the auth token from a login response before it is logged, so users
 * pasting debug logs (e.g. into GitHub issues) don't expose their session token.
 */
function redactToken(raw) {
    if (raw && typeof raw === 'object' && 'token' in raw) {
        return { ...raw, token: '<redacted>' };
    }
    return raw;
}
function parseJwtExpiry(token) {
    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return decoded.exp * 1000; // convert to ms
    }
    catch {
        return 0;
    }
}
function request(method, path, headers, body) {
    return new Promise((resolve, reject) => {
        const bodyStr = body ? JSON.stringify(body) : undefined;
        const reqHeaders = { ...headers };
        if (bodyStr) {
            reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr).toString();
        }
        const req = https.request({
            hostname: API_BASE,
            path,
            method,
            headers: reqHeaders,
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
                    return;
                }
                if (!raw) {
                    resolve(undefined);
                    return;
                }
                try {
                    resolve(JSON.parse(raw));
                }
                catch {
                    reject(new Error(`Failed to parse response: ${raw}`));
                }
            });
        });
        req.on('error', reject);
        if (bodyStr) {
            req.write(bodyStr);
        }
        req.end();
    });
}
class GrizzlEApi {
    constructor(email, password, log) {
        this.email = email;
        this.password = password;
        this.log = log;
        this.token = null;
        this.tokenExpiry = 0;
        this.loginInFlight = null;
    }
    async ensureToken() {
        if (this.token && Date.now() < this.tokenExpiry - 30000) {
            return;
        }
        // Deduplicate concurrent login attempts
        if (this.loginInFlight) {
            return this.loginInFlight;
        }
        this.loginInFlight = this.login().finally(() => {
            this.loginInFlight = null;
        });
        return this.loginInFlight;
    }
    async login() {
        this.log.debug('Logging in to Grizzl-E Connect API');
        const raw = await request('POST', '/client/auth/login', APP_HEADERS, {
            emailOrPhone: this.email,
            password: this.password,
        });
        this.log.debug(`Login raw response: ${JSON.stringify(redactToken(raw))}`);
        const resp = raw;
        if (!resp.token) {
            throw new Error(`Login did not return a token. Response: ${JSON.stringify(redactToken(raw))}`);
        }
        this.token = resp.token;
        this.tokenExpiry = parseJwtExpiry(resp.token);
        this.log.debug(`Logged in as ${resp.user.firstName} ${resp.user.lastName}`);
    }
    authHeaders() {
        return { ...APP_HEADERS, Authorization: `Bearer ${this.token}` };
    }
    async getStations() {
        await this.ensureToken();
        const raw = await request('GET', '/client/stations?includeShared=true&getLegacySchedulePrices=true', this.authHeaders());
        this.log.debug(`getStations raw response: ${JSON.stringify(raw)}`);
        let list;
        if (Array.isArray(raw)) {
            list = raw;
        }
        else {
            // Some APIs wrap the array: { data: [...] } or { stations: [...] } or { items: [...] }
            const wrapped = raw;
            const inner = wrapped['data'] ?? wrapped['stations'] ?? wrapped['items'];
            if (Array.isArray(inner)) {
                list = inner;
            }
            else {
                throw new Error(`Unexpected getStations response shape: ${JSON.stringify(raw)}`);
            }
        }
        // Ensure connectors is always an array
        for (const s of list) {
            s.connectors = s.connectors ?? [];
        }
        return list;
    }
    async getStation(id) {
        await this.ensureToken();
        const raw = await request('GET', `/client/stations/${id}?getLegacySchedulePrices=true`, this.authHeaders());
        this.log.debug(`getStation(${id}) raw response: ${JSON.stringify(raw)}`);
        const station = raw;
        station.connectors = station.connectors ?? [];
        return station;
    }
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
    async setStationEnabled(id) {
        await this.ensureToken();
        const raw = await request('POST', `/client/stations/${id}/mode`, this.authHeaders(), {
            mode: 'Active',
            connectorId: 1,
        });
        this.log.debug(`setStationEnabled(${id}) response: ${JSON.stringify(raw)}`);
    }
    async setStationDisabled(id) {
        await this.ensureToken();
        const raw = await request('POST', `/client/stations/${id}/mode`, this.authHeaders(), {
            mode: 'Inactive',
            connectorId: 1,
        });
        this.log.debug(`setStationDisabled(${id}) response: ${JSON.stringify(raw)}`);
    }
}
exports.GrizzlEApi = GrizzlEApi;
//# sourceMappingURL=grizzlEApi.js.map