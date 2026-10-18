// SPDX-License-Identifier: Apache-2.0
// D18-3: free text to the closest numbered option, in the browser only.
const words = (t: string) => t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["team", "the", "and", "for", "will", "with"].includes(w));
export function matchOption(text: string, labels: string[]): { index: number; score: number } | null {
  const q = new Set(words(text));
  if (!q.size) return null;
  let best: { index: number; score: number } | null = null;
  labels.forEach((label, index) => {
    const l = words(label);
    const hits = l.filter((w) => q.has(w) || [...q].some((x) => x.length > 3 && (w.startsWith(x) || x.startsWith(w)))).length;
    const score = l.length ? hits / l.length : 0;
    if (score > 0 && (!best || score > best.score)) best = { index, score };
  });
  return best;
}
