import { UAParser } from "ua-parser-js";

export interface DeviceInfo {
  device: string;
  browser: string;
  os: string;
}

export function parseUserAgent(userAgent: string | null): DeviceInfo {
  if (!userAgent) return { device: "unknown", browser: "unknown", os: "unknown" };

  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    device: result.device.type ?? "desktop",
    browser: result.browser.name ?? "unknown",
    os: result.os.name ?? "unknown",
  };
}
