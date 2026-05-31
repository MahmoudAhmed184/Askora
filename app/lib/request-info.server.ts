import { hashWithHmacSha256 } from "~/lib/crypto.server";

const FORWARDED_FOR_HEADER = "x-forwarded-for";
const CLIENT_IP_HEADERS = [
  "cf-connecting-ip",
  "fly-client-ip",
  "x-real-ip",
  "x-client-ip",
] as const;

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

function getClientIpAddress(request: Request) {
  const forwardedFor = request.headers.get(FORWARDED_FOR_HEADER);
  const forwardedIpAddress = getFirstForwardedIpAddress(forwardedFor);

  if (forwardedIpAddress !== undefined) {
    return forwardedIpAddress;
  }

  for (const headerName of CLIENT_IP_HEADERS) {
    const value = request.headers.get(headerName)?.trim();

    if (value !== undefined && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function getFirstForwardedIpAddress(headerValue: string | null) {
  if (headerValue === null) {
    return undefined;
  }

  const [firstIpAddress] = headerValue.split(",");
  const trimmedIpAddress = firstIpAddress?.trim();

  return trimmedIpAddress === undefined || trimmedIpAddress.length === 0
    ? undefined
    : trimmedIpAddress;
}
