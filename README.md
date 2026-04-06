# homebridge-grizzl-e

[![npm](https://img.shields.io/npm/v/homebridge-grizzl-e)](https://www.npmjs.com/package/homebridge-grizzl-e)
[![npm](https://img.shields.io/npm/dt/homebridge-grizzl-e)](https://www.npmjs.com/package/homebridge-grizzl-e)

A [Homebridge](https://homebridge.io) plugin for [Grizzl-E Connect](https://grizzl-e.com) EV chargers by United Chargers.

Each charger in your Grizzl-E Connect account is exposed as a HomeKit accessory with full charging status visibility and control — all on a single accessory detail page.

## HomeKit Accessory

Each charger exposes the following:

### Outlet (main control)
| Feature | Description |
|---|---|
| **On / Off** | Enable or disable charging |
| **Outlet In Use** | Lit when the car is actively drawing power |
| **Fault** | Warning badge shown when the charger reports an error |
| **No Response** | Shown when the charger is offline |

### Car Plugged In
An occupancy sensor that activates whenever a car is physically connected to the charger — regardless of whether charging is active or paused.

### Connector Status Sensors
Five individual occupancy sensors, each usable as a HomeKit automation trigger:

| Sensor | Active when... |
|---|---|
| **Preparing** | Car is connected and the session is initializing |
| **Charging** | Car is actively drawing power |
| **Suspended by Charger** | The charger (EVSE) has paused the session |
| **Suspended by Car** | The car's battery management system has paused the session |
| **Finishing** | The charging session is winding down |

These map directly to the OCPP standard connector statuses (`Preparing`, `Charging`, `SuspendedEVSE`, `SuspendedEV`, `Finishing`).

## Requirements

- A Grizzl-E Connect account with at least one charger
- Homebridge v1.6.0 or later
- Node.js v20 or later

## Installation

Search for **Grizzl-E Homebridge** in the Homebridge UI, or install manually:

```bash
npm install -g homebridge-grizzl-e
```

## Configuration

Configure via the Homebridge UI, or add to your `config.json`:

```json
{
  "platform": "GrizzlE",
  "name": "Grizzl-E",
  "email": "you@example.com",
  "password": "your-password",
  "pollInterval": 30
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `email` | ✅ | — | Your Grizzl-E Connect account email |
| `password` | ✅ | — | Your Grizzl-E Connect account password |
| `pollInterval` | ❌ | `30` | How often (in seconds) to poll for status updates (10–300) |

## How It Works

The plugin authenticates with the Grizzl-E Connect cloud API using your account credentials. All chargers in your account are automatically discovered. The plugin polls the API on a configurable interval and pushes state changes to HomeKit immediately as they occur.

Chargers that are offline (not connected to the internet) show **No Response** in HomeKit rather than stale data.

## Automations

Because each status is exposed as an individual occupancy sensor, you can build precise HomeKit automations:

**Demand response (paired with [homebridge-hilo-challenge](https://github.com/justinjsp/homebridge-hilo-challenge)):**
- **When** Hilo Reduction sensor opens → **Turn off** charger
- **When** Hilo Reduction sensor closes → **Turn on** charger

**Notifications:**
- **When** Suspended by Charger activates → send notification (unexpected pause)
- **When** Charging activates → send notification (charging started)
- **When** Finishing activates → send notification (charging complete)

## Issues & Support

Please open an issue on [GitHub](https://github.com/justinjsp/homebridge-grizzl-e/issues).

## Disclaimer

This plugin is an independent, community-developed project and is **not affiliated with, endorsed by, or supported by United Chargers Inc.** in any way. Grizzl-E™ is a trademark of United Chargers Inc. All product names and trademarks are the property of their respective owners.

This plugin is provided **as-is, without any warranty of any kind**, express or implied. Use it at your own risk. The authors accept no responsibility for any damage, data loss, or other issues arising from its use.
