/** Reverses worker/lib/obfuscate.ts's obfuscateEmail() to get a real, clickable mailto: address. */
export function decodeEmail(encoded: string): string {
  try {
    return atob(encoded).split("").reverse().join("");
  } catch {
    return encoded; // already plain (e.g. local dev data saved before this existed)
  }
}
