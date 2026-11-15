// Deterrent, not encryption: this defeats the cheapest and most common
// scraping method (a regex scanning raw HTML/API text for an @...
// pattern) without requiring visitors to run any extra steps. A
// determined, targeted scraper could still reverse it — that's an
// accepted tradeoff for a public "here's my email" link, same one used
// by most email-obfuscation plugins/services.
export function obfuscateEmail(email: string): string {
  const reversed = email.split("").reverse().join("");
  return btoa(reversed);
}
