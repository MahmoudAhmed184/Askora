const proxiedAvatarHosts = ["googleusercontent.com"];

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

  return proxiedAvatarHosts.some(
    (allowedHostname) =>
      normalizedHostname === allowedHostname ||
      normalizedHostname.endsWith(`.${allowedHostname}`),
  );
}

function isGoogleAccountAvatarPath(pathname: string) {
  return pathname === "/a" || pathname.startsWith("/a/");
}
