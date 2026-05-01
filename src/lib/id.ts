/**
 * Tiny URL-safe random ID. Avoids pulling nanoid as a dep.
 * 21 chars, ~120 bits of entropy.
 */
export function nanoid(size = 21): string {
  const bytes = new Uint8Array(size);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const alphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  let out = "";
  for (let i = 0; i < size; i++) out += alphabet[bytes[i] & 63];
  return out;
}
