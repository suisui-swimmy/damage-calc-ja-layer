const HIRAGANA_START = 0x3041;
const HIRAGANA_END = 0x3096;
const KATAKANA_OFFSET = 0x60;

export const toCalcId = (value: string): string =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

export const hiraganaToKatakana = (value: string): string =>
  Array.from(value)
    .map((char) => {
      const codePoint = char.codePointAt(0);
      if (codePoint === undefined) {
        return char;
      }
      if (codePoint >= HIRAGANA_START && codePoint <= HIRAGANA_END) {
        return String.fromCodePoint(codePoint + KATAKANA_OFFSET);
      }
      return char;
    })
    .join("");

export const normalizeJaSearchText = (value: string): string =>
  hiraganaToKatakana(value.normalize("NFKC").toLowerCase())
    .replace(/[・･ーｰ\s_'’"“”.,:;()[\]{}<>/\\|+*?!？!%％-]+/g, "")
    .trim();
