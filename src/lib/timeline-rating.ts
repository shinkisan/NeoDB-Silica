export function parseTimelineRenderedRating(content: string) {
  const glyphs = /(?:🌕|🌗|🌑){5}/.exec(content)?.[0];
  if (!glyphs) return null;

  return Array.from(glyphs).reduce((grade, glyph) => {
    if (glyph === "🌕") return grade + 2;
    if (glyph === "🌗") return grade + 1;
    return grade;
  }, 0);
}

export function stripTimelineRenderedRating(content: string) {
  return content
    .replace(/[ \t]*(?:🌕|🌗|🌑){5}[ \t]*/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
}
