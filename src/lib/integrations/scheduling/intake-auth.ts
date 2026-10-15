import { timingSafeEqual } from "crypto";

export function schedulingIntakeSecret(): string | null {
  const secret = process.env.SCHEDULING_INTAKE_SECRET?.trim();
  if (!secret || secret === "replace-with-a-long-random-string") {
    return null;
  }
  return secret;
}

export function schedulingSecretMatches(provided: string | null, expected: string): boolean {
  if (!provided) {
    return false;
  }
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

export function bearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader.trim());
  return match?.[1] ?? null;
}
