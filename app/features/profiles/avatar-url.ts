const proxiedAvatarHost = "lh3.googleusercontent.com";

export function getAvatarImageSource(avatarUrl: string) {
  return isAllowedProxiedAvatarUrl(avatarUrl)
    ? `/api/avatar?src=${encodeURIComponent(avatarUrl)}`
    : avatarUrl;
}

export function isAllowedProxiedAvatarUrl(avatarUrl: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(avatarUrl);
  } catch {
    return false;
  }

  return (
    parsedUrl.protocol === "https:" &&
    isAllowedAvatarHostname(parsedUrl.hostname) &&
    isGoogleAccountAvatarPath(parsedUrl.pathname)
  );
}

function isAllowedAvatarHostname(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();

  return normalizedHostname === proxiedAvatarHost;
}

function isGoogleAccountAvatarPath(pathname: string) {
  return pathname === "/a" || pathname.startsWith("/a/");
}
