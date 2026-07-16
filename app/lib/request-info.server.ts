import { hashWithHmacSha256 } from "~/lib/crypto.server";
import { serverEnv } from "~/lib/env.server";

const FORWARDED_FOR_HEADER = "x-forwarded-for";

export interface RequestInfoHashes {
  ipHash: string;
  userAgentHash: string;
  fingerprintHash: string;
}

export function getRequestInfoHashes(request: Request): RequestInfoHashes {
  const clientIpAddress = getClientIpAddress(request) ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  return {
    ipHash: hashWithHmacSha256(clientIpAddress, "request-ip"),
    userAgentHash: hashWithHmacSha256(userAgent, "request-user-agent"),
    fingerprintHash: hashWithHmacSha256(
      `${clientIpAddress}\0${userAgent}`,
      "request-fingerprint",
    ),
  };
}

export function getClientIpAddress(request: Request) {
  const trustedHeaderValue = getSingleHeaderValue(
    request.headers.get(serverEnv.TRUSTED_PROXY_IP_HEADER),
  );

  if (trustedHeaderValue !== undefined) {
    return trustedHeaderValue;
  }

  return getForwardedIpAddress(
    request.headers.get(FORWARDED_FOR_HEADER),
    serverEnv.TRUSTED_PROXY_HOPS,
  );
}

function getSingleHeaderValue(headerValue: string | null) {
  const trimmedHeaderValue = headerValue?.trim();

  if (
    trimmedHeaderValue === undefined ||
    trimmedHeaderValue.length === 0 ||
    trimmedHeaderValue.includes(",")
  ) {
    return undefined;
  }

  return trimmedHeaderValue;
}

function getForwardedIpAddress(
  headerValue: string | null,
  trustedProxyHops: number,
) {
  if (headerValue === null) {
    return undefined;
  }

  const ipAddresses = headerValue
    .split(",")
    .map((ipAddress) => ipAddress.trim())
    .filter((ipAddress) => ipAddress.length > 0);
  const untrustedIpIndex = Math.max(
    0,
    ipAddresses.length - trustedProxyHops - 1,
  );

  return ipAddresses[untrustedIpIndex];
}
