import * as https from 'https';
import * as http from 'http';

const API_BASE = 'connect-api.unitedchargers.com';

// Headers captured from the Grizzl-E Connect iOS app
const APP_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'User-Agent': 'GrizzlEConnect/115 CFNetwork/3826.500.131 Darwin/24.5.0',
  'x-app-client': 'Apple, iPad14,3, iPadOS 18.5',
  'x-app-version': 'v0.9.2 (115)',
  'x-application-name': 'Grizzl-E Connect',
};

export interface GrizzlEConnector {
  id: number;
  type: string;
  // OCPP standard statuses: Available, Preparing, Charging, SuspendedEVSE,
  // SuspendedEV, Finishing, Reserved, Unavailable, Faulted
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

interface LoginResponse {
  token: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface JwtPayload {
  exp: number;
}

function parseJwtExpiry(token: string): number {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtPayload;
    return decoded.exp * 1000; // convert to ms
  } catch {
    return 0;
  }
}

function request<T>(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const reqHeaders: Record<string, string> = { ...headers };
    if (bodyStr) {
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr).toString();
    }

    const req = https.request(
      {
        hostname: API_BASE,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
            return;
          }
          if (!raw) {
            resolve(undefined as T);
            return;
          }
          try {
            resolve(JSON.parse(raw) as T);
          } catch {
            reject(new Error(`Failed to parse response: ${raw}`));
          }
        });
      },
    );

    req.on('error', reject);
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

export class GrizzlEApi {
  private token: string | null = null;
  private tokenExpiry = 0;
  private loginInFlight: Promise<void> | null = null;

  constructor(
    private readonly email: string,
    private readonly password: string,
    private readonly log: { error: (msg: string) => void; debug: (msg: string) => void },
  ) {}

  private async ensureToken(): Promise<void> {
    if (this.token && Date.now() < this.tokenExpiry - 30_000) {
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

  private async login(): Promise<void> {
    this.log.debug('Logging in to Grizzl-E Connect API');
    const raw = await request<unknown>('POST', '/client/auth/login', APP_HEADERS, {
      emailOrPhone: this.email,
      password: this.password,
    });
    this.log.debug(`Login raw response: ${JSON.stringify(raw)}`);
    const resp = raw as LoginResponse;
    if (!resp.token) {
      throw new Error(`Login did not return a token. Response: ${JSON.stringify(raw)}`);
    }
    this.token = resp.token;
    this.tokenExpiry = parseJwtExpiry(resp.token);
    this.log.debug(`Logged in as ${resp.user.firstName} ${resp.user.lastName}`);
  }

  private authHeaders(): Record<string, string> {
    return { ...APP_HEADERS, Authorization: `Bearer ${this.token}` };
  }

  async getStations(): Promise<GrizzlEStation[]> {
    await this.ensureToken();
    const raw = await request<unknown>('GET', '/client/stations?includeShared=true&getLegacySchedulePrices=true', this.authHeaders());
    this.log.debug(`getStations raw response: ${JSON.stringify(raw)}`);
    let list: GrizzlEStation[];
    if (Array.isArray(raw)) {
      list = raw as GrizzlEStation[];
    } else {
      // Some APIs wrap the array: { data: [...] } or { stations: [...] } or { items: [...] }
      const wrapped = raw as Record<string, unknown>;
      const inner = wrapped['data'] ?? wrapped['stations'] ?? wrapped['items'];
      if (Array.isArray(inner)) {
        list = inner as GrizzlEStation[];
      } else {
        throw new Error(`Unexpected getStations response shape: ${JSON.stringify(raw)}`);
      }
    }
    // Ensure connectors is always an array
    for (const s of list) {
      s.connectors = s.connectors ?? [];
    }
    return list;
  }

  async getStation(id: string): Promise<GrizzlEStation> {
    await this.ensureToken();
    const raw = await request<unknown>('GET', `/client/stations/${id}?getLegacySchedulePrices=true`, this.authHeaders());
    this.log.debug(`getStation(${id}) raw response: ${JSON.stringify(raw)}`);
    const station = raw as GrizzlEStation;
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
  async setStationEnabled(id: string): Promise<void> {
    await this.ensureToken();
    const raw = await request<unknown>('POST', `/client/stations/${id}/mode`, this.authHeaders(), {
      mode: 'Active',
      connectorId: 1,
    });
    this.log.debug(`setStationEnabled(${id}) response: ${JSON.stringify(raw)}`);
  }

  async setStationDisabled(id: string): Promise<void> {
    await this.ensureToken();
    const raw = await request<unknown>('POST', `/client/stations/${id}/mode`, this.authHeaders(), {
      mode: 'Inactive',
      connectorId: 1,
    });
    this.log.debug(`setStationDisabled(${id}) response: ${JSON.stringify(raw)}`);
  }
}
