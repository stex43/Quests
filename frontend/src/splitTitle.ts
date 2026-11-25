export interface TitleParts {
  prefix: string;
  dropCap: string;
  rest: string;
}

const HAS_LETTER_OR_DIGIT_START = /^[\p{L}\p{N}]/u;
let segmenter: Intl.Segmenter | null | undefined;

/** Grapheme clusters where Intl.Segmenter exists; older browsers fall back to code points. */
function graphemesOf(text: string): string[] {
  if (segmenter === undefined) {
    segmenter =
      typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
        ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
        : null;
  }
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
}

/**
 * Splits a title into the drop cap (first grapheme cluster starting with a letter or
 * digit), the graphemes before it (e.g. an opening quote), and the remainder. A title
 * with no such grapheme falls back to its first grapheme, so emoji and combining
 * sequences are never torn apart.
 */
export function splitTitle(title: string): TitleParts {
  const graphemes = graphemesOf(title);
  let index = graphemes.findIndex((g) => HAS_LETTER_OR_DIGIT_START.test(g));
  if (index < 0) index = 0;
  return {
    prefix: index > 0 ? graphemes.slice(0, index).join("") : "",
    dropCap: graphemes[index] ?? "",
    rest: graphemes.slice(index + 1).join(""),
  };
}

const CYRILLIC = /\p{Script=Cyrillic}/u;

/** Whether the text contains Cyrillic, which Cinzel lacks and the fallback font draws in mixed case. */
export function hasCyrillic(text: string): boolean {
  return CYRILLIC.test(text);
}
