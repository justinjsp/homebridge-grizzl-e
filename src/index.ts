import { API } from 'homebridge';
import { GrizzlEPlatform, PLATFORM_NAME } from './platform';

// homebridge requires CommonJS-style export
export = (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, GrizzlEPlatform);
};
