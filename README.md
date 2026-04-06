# homebridge-grizzl-e

[![npm](https://img.shields.io/npm/v/homebridge-grizzl-e)](https://www.npmjs.com/package/homebridge-grizzl-e)
[![npm](https://img.shields.io/npm/dt/homebridge-grizzl-e)](https://www.npmjs.com/package/homebridge-grizzl-e)

A [Homebridge](https://homebridge.io) plugin for [Grizzl-E Connect](https://grizzl-e.com) EV chargers by United Chargers.

Exposes each charger in your Grizzl-E Connect account as a **HomeKit outlet**:
- **On / Off** — enable or disable charging
- **Outlet In Use** — indicates the car is actively drawing power
- **No Response** — shown when the charger is offline

This enables HomeKit automations such as automatically disabling EV charging during demand response events (e.g. Hilo / Hydro-Québec challenges).

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

The plugin authenticates with the Grizzl-E Connect cloud API using your account credentials. All chargers in your account are automatically discovered and exposed as HomeKit outlet accessories. The plugin polls the API on a configurable interval to keep charger state in sync.

Chargers that are offline (not connected to the internet) will show **No Response** in HomeKit rather than a stale state.

## Automations

A common use case is pairing this plugin with **[homebridge-hilo-challenge](https://github.com/justinjsp/homebridge-hilo-challenge)** to automatically disable EV charging during Hilo demand response reduction phases:

- **When** Hilo Reduction sensor opens → **Turn off** Grizzl-E charger(s)
- **When** Hilo Reduction sensor closes → **Turn on** Grizzl-E charger(s)

## Issues & Support

Please open an issue on [GitHub](https://github.com/justinjsp/homebridge-grizzl-e/issues).
