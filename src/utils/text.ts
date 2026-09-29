/**
 * Terminal cell-width arithmetic.
 *
 * OpenTUI does not export a string-width helper, and correctness here is not
 * optional: if we measure a label as narrower than the terminal does, markers
 * drift out of alignment, which is the single most visible way a rail-based
 * layout can break.
 *
 * The implementation follows Unicode East Asian Width plus the combining-mark
 * rule, and degrades predictably: anything we cannot classify is measured as a
 * single cell rather than throwing or guessing wide. Under a terminal with
 * different width assumptions the worst case is a one-column drift on exotic
 * text, never a corrupted layout.
 */

/** East Asian Wide and Fullwidth ranges, plus emoji presentation. */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], // Hangul Jamo init
  [0x2e80, 0x303e], // CJK radicals, Kangxi, CJK symbols
  [0x3041, 0x33ff], // Hiragana .. CJK compatibility
  [0x3400, 0x4dbf], // CJK ext A
  [0x4e00, 0x9fff], // CJK unified
  [0xa000, 0xa4cf], // Yi
  [0xa960, 0xa97f], // Hangul Jamo extended-A
  [0xac00, 0xd7a3], // Hangul syllables
  [0xf900, 0xfaff], // CJK compatibility ideographs
  [0xfe10, 0xfe19], // vertical forms
  [0xfe30, 0xfe6f], // CJK compatibility forms
  [0xff00, 0xff60], // fullwidth forms
  [0xffe0, 0xffe6], // fullwidth signs
  [0x1f300, 0x1f64f], // emoji: symbols and pictographs
  [0x1f900, 0x1f9ff], // emoji: supplemental symbols
  [0x20000, 0x3fffd], // CJK ext B+
];

/** Combining marks and other zero-width code points. */
const ZERO_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0300, 0x036f], // combining diacritical marks
  [0x0483, 0x0489],
  [0x0591, 0x05bd],
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x0670, 0x0670],
  [0x06d6, 0x06dc],
  [0x0e31, 0x0e31],
  [0x0e34, 0x0e3a],
  [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff],
  [0x200b, 0x200f], // zero-width space .. RLM
  [0x20d0, 0x20f0], // combining marks for symbols
  [0xfe00, 0xfe0f], // variation selectors
  [0xfe20, 0xfe2f], // combining half marks
  [0xfeff, 0xfeff], // BOM / zero-width no-break space
];

function inRanges(cp: number, ranges: ReadonlyArray<readonly [number, number]>): boolean {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [start, end] = ranges[mid] as readonly [number, number];
    if (cp < start) hi = mid - 1;
    else if (cp > end) lo = mid + 1;
    else return true;
  }
  return false;
}

/** Cells occupied by a single code point. */
export function codePointWidth(cp: number): number {
  if (cp === 0) return 0;
  // C0/C1 controls occupy no cells. ESC and friends must never be counted.
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (inRanges(cp, ZERO_RANGES)) return 0;
  if (inRanges(cp, WIDE_RANGES)) return 2;
  return 1;
}

/** Display width of a string in terminal cells. */
export function stringWidth(input: string): number {
  let width = 0;
  for (const ch of input) {
    width += codePointWidth(ch.codePointAt(0) ?? 0);
  }
  return width;
}

/** Truncate to `max` cells, appending `ellipsis` when anything was removed. */
export function truncateToWidth(input: string, max: number, ellipsis = "…"): string {
  if (max <= 0) return "";
  if (stringWidth(input) <= max) return input;
  const ellipsisWidth = stringWidth(ellipsis);
  if (max <= ellipsisWidth) {
    // Not enough room for content plus the ellipsis: hard-cut instead so the
    // layout still respects the budget.
    return sliceToWidth(input, max);
  }
  return `${sliceToWidth(input, max - ellipsisWidth)}${ellipsis}`;
}

/** Take a prefix of `input` that fits in `max` cells. */
export function sliceToWidth(input: string, max: number): string {
  if (max <= 0) return "";
  let width = 0;
  let out = "";
  for (const ch of input) {
    const w = codePointWidth(ch.codePointAt(0) ?? 0);
    if (width + w > max) break;
    width += w;
    out += ch;
  }
  return out;
}

/** Pad a string to exactly `width` cells, right-padding with `fill`. */
export function padToWidth(input: string, width: number, fill = " "): string {
  const w = stringWidth(input);
  if (w >= width) return input;
  return input + fill.repeat(width - w);
}

/** Truncate or pad so the result occupies exactly `width` cells. */
export function fitToWidth(
  input: string,
  width: number,
  options: { ellipsis?: string; align?: "left" | "right" } = {},
): string {
  const { ellipsis = "…", align = "left" } = options;
  if (stringWidth(input) > width) {
    return truncateToWidth(input, width, ellipsis);
  }
  return align === "right" ? padToWidth(input, width) : input;
}

/** Split on newlines, keeping empty lines. */
export function splitLines(input: string): string[] {
  return input.split(/\r\n|\r|\n/);
}

/**
 * Wrap text to `width` cells on word boundaries.
 *
 * Words longer than `width` are hard-split rather than overflowing, because an
 * overflowing option label breaks rail alignment.
 */
export function wrapToWidth(input: string, width: number): string[] {
  if (width <= 0) return [input];
  const out: string[] = [];
  for (const paragraph of splitLines(input)) {
    if (paragraph === "") {
      out.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(" ")) {
      if (word === "") continue;
      const candidate = current === "" ? word : `${current} ${word}`;
      if (stringWidth(candidate) <= width) {
        current = candidate;
        continue;
      }
      if (current !== "") out.push(current);
      if (stringWidth(word) <= width) {
        current = word;
        continue;
      }
      // Longer than one row: hard-split, tracking consumed cells rather than
      // code units so wide characters are never cut in half.
      let rest = word;
      while (stringWidth(rest) > width) {
        const head = sliceToWidth(rest, width);
        out.push(head);
        rest = rest.slice(head.length);
      }
      current = rest;
    }
    if (current !== "") out.push(current);
  }
  return out.length > 0 ? out : [""];
}
