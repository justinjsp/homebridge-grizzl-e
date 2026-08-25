# Changelog

All notable changes to **homebridge-grizzl-e** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.10] - 2026-08-25

### Security
- Redact the auth token from the login-response debug logs so it can't leak when
  users share debug output (e.g. in GitHub issues). Flagged during Homebridge
  verification review.

### Added
- "Verified by Homebridge" badge in the README.

## [0.1.9] - 2026-08-24

### Fixed
- `config.schema.json`: moved required-field validation to a schema-level
  `required` array — individual `"required": true` flags are invalid JSON Schema.
- `config.schema.json`: added the `name` property.

### Removed
- `homebridge` from `peerDependencies`; it belongs only in `devDependencies`
  (Homebridge is provided by the host at runtime).

## [0.1.8] - 2026-08-24

### Added
- `LICENSE` file (MIT).
- `supports-hap` keyword so the Homebridge UI shows the correct transport badge.

### Changed
- The platform now validates required configuration (`email` and `password`) in
  its constructor. When they are missing it logs a clear error and does **not**
  start — no authentication attempt and no accessories are registered.

### Fixed
- Errors thrown from the `didFinishLaunching` startup handler are now caught and
  logged, preventing any unhandled promise rejection during startup.

## [0.1.7] - 2026-08-24

### Changed
- Declared Node.js 24 support and opened the `engines.node` range to `>=18.20.4`
  so future Node major versions load without a plugin update.
- Bumped `@types/node` to `^24`.

### Removed
- Unused `http` import.

## [0.1.6] - 2026-04-06

### Fixed
- Outlet no longer reverts to Off while a charger reports `SuspendedEVSE`.

## [0.1.5] - 2026-04-06

### Added
- Homebridge v2.0 compatibility.

## [0.1.4] - 2026-04-06

### Changed
- Documented all HomeKit accessory features in the README.

## [0.1.3] - 2026-04-06

### Added
- Per-connector OCPP status sensors (Preparing, Charging, SuspendedEVSE,
  SuspendedEV, Finishing).
- Car plugged-in occupancy sensor.

## [0.1.2] - 2026-04-05

### Added
- Plugin icon.
- Disclaimer of no affiliation with United Chargers Inc.

## [0.1.1] - 2026-04-05

### Added
- Initial release. Exposes Grizzl-E Connect EV chargers as HomeKit Outlet
  accessories with enable/disable charging and Outlet In Use support.

[0.1.10]: https://github.com/justinjsp/homebridge-grizzl-e/releases/tag/v0.1.10
[0.1.9]: https://github.com/justinjsp/homebridge-grizzl-e/releases/tag/v0.1.9
[0.1.8]: https://github.com/justinjsp/homebridge-grizzl-e/releases/tag/v0.1.8
[0.1.7]: https://github.com/justinjsp/homebridge-grizzl-e/releases/tag/v0.1.7
[0.1.6]: https://github.com/justinjsp/homebridge-grizzl-e/releases/tag/v0.1.6
[0.1.5]: https://github.com/justinjsp/homebridge-grizzl-e/releases/tag/v0.1.5
[0.1.4]: https://github.com/justinjsp/homebridge-grizzl-e/releases/tag/v0.1.4
[0.1.3]: https://github.com/justinjsp/homebridge-grizzl-e/releases/tag/v0.1.3
[0.1.2]: https://github.com/justinjsp/homebridge-grizzl-e/releases/tag/v0.1.2
[0.1.1]: https://github.com/justinjsp/homebridge-grizzl-e/releases/tag/v0.1.1
