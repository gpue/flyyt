/**
 * VDA5050 NATS subject parsing: `{prefix}.{versionMajor}.{manufacturer}.
 * {serial}.{messageType}` (matches flyyt-backend's transport.py). Only the
 * plain public shape -- no Nova-platform-specific subject variants (this
 * project is self-contained and open source, not dependent on any
 * Wandelbots-internal infrastructure).
 */

export interface ParsedVda5050Subject {
  versionMajor: string;
  manufacturer: string;
  serial: string;
  messageType: string;
}

export function parseVda5050Subject(subject: string): ParsedVda5050Subject | null {
  const parts = subject.split(".");
  if (parts.length >= 5 && parts[0] === "vda5050") {
    return {
      versionMajor: parts[1],
      manufacturer: parts[2],
      serial: parts[3],
      messageType: parts[4],
    };
  }
  return null;
}
