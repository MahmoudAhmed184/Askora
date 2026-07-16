const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{1,68}$/;

export function isBoundedPublicId(value: string) {
  return PUBLIC_ID_PATTERN.test(value);
}
