import referenceDataJson from "../data/overrides/smogon-ko-reference-ja.json";

export type SmogonKoReferenceTranslationStatus =
  | "translated"
  | "source-empty"
  | "unsupported-calc-version"
  | "unsupported-template"
  | "unknown-effect";

export interface SmogonKoReferenceTranslation {
  sourceTextEn: string;
  referenceTextJa?: string;
  displayText: string;
  status: SmogonKoReferenceTranslationStatus;
  isAuthoritative: false;
  calcVersion: string;
  templateProfile: "smogon-calc-0.11.0";
}

interface ReferenceData {
  schemaVersion: number;
  status: "reference";
  source: {
    package: string;
    version: string;
  };
  templateProfile: string;
  effects: Record<string, string>;
}

type ParseFailureStatus = "unsupported-template" | "unknown-effect";

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: ParseFailureStatus };

type KoTarget =
  | { unit: "hits"; count: number }
  | { unit: "turns"; count: number };

interface ParsedClause {
  kind: "not-ko" | "guaranteed" | "possible" | "chance";
  approximate: boolean;
  target?: KoTarget;
  percentage?: string;
  effectsJa: string[];
}

const TEMPLATE_PROFILE = "smogon-calc-0.11.0" as const;
const referenceData = referenceDataJson as ReferenceData;
const SUPPORTED_CALC_VERSION = "0.11.0";

if (
  referenceData.schemaVersion !== 1 ||
  referenceData.status !== "reference" ||
  referenceData.source.package !== "@smogon/calc" ||
  referenceData.source.version !== SUPPORTED_CALC_VERSION ||
  referenceData.templateProfile !== TEMPLATE_PROFILE
) {
  throw new Error("Invalid Smogon KO reference translation profile metadata");
}

const effectReferenceJa: Readonly<Record<string, string>> = referenceData.effects;

const success = <T>(value: T): ParseResult<T> => ({ ok: true, value });

const failure = <T>(status: ParseFailureStatus): ParseResult<T> => ({
  ok: false,
  status,
});

const parsePositiveInteger = (value: string): number | undefined => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const parseTarget = (source: string): KoTarget | undefined => {
  if (source === "OHKO") {
    return { unit: "hits", count: 1 };
  }

  const hitMatch = /^([1-9]\d*)HKO$/.exec(source);
  if (hitMatch) {
    const count = parsePositiveInteger(hitMatch[1]);
    return count !== undefined && count >= 2
      ? { unit: "hits", count }
      : undefined;
  }

  const turnMatch = /^KO in ([1-9]\d*) turns$/.exec(source);
  if (turnMatch) {
    const count = parsePositiveInteger(turnMatch[1]);
    return count !== undefined && count >= 2
      ? { unit: "turns", count }
      : undefined;
  }

  return undefined;
};

const splitEffectSources = (source: string): string[] | undefined => {
  if (source.length === 0) {
    return undefined;
  }

  if (source.includes(",")) {
    const finalSeparatorIndex = source.lastIndexOf(", and ");
    if (finalSeparatorIndex < 0) {
      return undefined;
    }

    const leading = source.slice(0, finalSeparatorIndex).split(", ");
    const finalEffect = source.slice(finalSeparatorIndex + ", and ".length);
    if (leading.length < 2 || leading.some((effect) => effect.length === 0) || !finalEffect) {
      return undefined;
    }

    return [...leading, finalEffect];
  }

  if (source.includes(" and ")) {
    const effects = source.split(" and ");
    return effects.length === 2 && effects.every((effect) => effect.length > 0)
      ? effects
      : undefined;
  }

  return [source];
};

const parseEffects = (source: string | undefined): ParseResult<string[]> => {
  if (source === undefined) {
    return success([]);
  }

  const effectSources = splitEffectSources(source);
  if (!effectSources) {
    return failure("unsupported-template");
  }

  const effectsJa: string[] = [];
  for (const effectSource of effectSources) {
    const effectJa = effectReferenceJa[effectSource];
    if (!effectJa) {
      return failure("unknown-effect");
    }
    effectsJa.push(effectJa);
  }

  return success(effectsJa);
};

const parseClause = (source: string): ParseResult<ParsedClause> => {
  const approximate = source.startsWith("approx. ");
  const body = approximate ? source.slice("approx. ".length) : source;

  if (body === "not a KO") {
    return success({
      kind: "not-ko",
      approximate,
      effectsJa: [],
    });
  }

  const outcomeMatch = /^(guaranteed|possible) (OHKO|[1-9]\d*HKO|KO in [1-9]\d* turns)(?: after (.+))?$/.exec(
    body,
  );
  const chanceMatch = /^((?:0|[1-9]\d*)(?:\.\d+)?)% chance to (OHKO|[1-9]\d*HKO|KO in [1-9]\d* turns)(?: after (.+))?$/.exec(
    body,
  );

  if (!outcomeMatch && !chanceMatch) {
    return failure("unsupported-template");
  }

  const kind = outcomeMatch?.[1] ?? "chance";
  if (approximate && kind === "guaranteed") {
    return failure("unsupported-template");
  }

  const targetSource = outcomeMatch?.[2] ?? chanceMatch?.[2];
  const target = targetSource ? parseTarget(targetSource) : undefined;
  if (!target) {
    return failure("unsupported-template");
  }

  const percentage = chanceMatch?.[1];
  if (percentage !== undefined) {
    const percentageValue = Number(percentage);
    if (!(percentageValue > 0 && percentageValue < 100)) {
      return failure("unsupported-template");
    }
  }

  const effects = parseEffects(outcomeMatch?.[3] ?? chanceMatch?.[3]);
  if (!effects.ok) {
    return effects;
  }

  return success({
    kind: kind as ParsedClause["kind"],
    approximate,
    target,
    percentage,
    effectsJa: effects.value,
  });
};

const effectPhrase = (effectsJa: string[]): string | undefined =>
  effectsJa.length > 0 ? `${effectsJa.join("・")}込み` : undefined;

const formatTarget = (target: KoTarget): string =>
  target.unit === "hits" ? `${target.count}発` : `${target.count}ターン`;

const formatStandaloneClause = (clause: ParsedClause): string => {
  if (clause.kind === "not-ko") {
    return clause.approximate ? "KO不可（概算）" : "KO不可";
  }

  const target = clause.target as KoTarget;
  const effects = effectPhrase(clause.effectsJa);

  if (clause.kind === "guaranteed") {
    const base = target.unit === "hits"
      ? `確定${formatTarget(target)}`
      : `${formatTarget(target)}で確定KO`;
    return effects ? `${base}（${effects}）` : base;
  }

  if (clause.kind === "possible") {
    const base = target.unit === "hits"
      ? `${formatTarget(target)}KOの可能性`
      : `${formatTarget(target)}でKOの可能性`;
    const details = ["確率算出不可"];
    if (effects) details.push(effects);
    if (clause.approximate) details.push("概算");
    return `${base}（${details.join("・")}）`;
  }

  const base = target.unit === "hits"
    ? `乱数${formatTarget(target)}`
    : `${formatTarget(target)}でKO`;
  const details = [`${clause.percentage}%`];
  if (effects) details.push(effects);
  if (clause.approximate) details.push("概算");
  return `${base}（${details.join("・")}）`;
};

const isOhkoTarget = (target: KoTarget | undefined): boolean =>
  target?.unit === "hits" && target.count === 1;

const formatAlternative = (
  primary: ParsedClause,
  alternative: ParsedClause,
): ParseResult<string> => {
  const isSupportedCombination =
    primary.kind === "chance" &&
    isOhkoTarget(primary.target) &&
    (alternative.kind === "guaranteed" || alternative.kind === "chance") &&
    isOhkoTarget(alternative.target) &&
    alternative.effectsJa.length > 0 &&
    (alternative.kind !== "chance" || alternative.approximate === primary.approximate);

  if (!isSupportedCombination) {
    return failure("unsupported-template");
  }

  const primaryEffects = effectPhrase(primary.effectsJa);
  const alternativeEffects = effectPhrase(alternative.effectsJa) as string;
  const primaryDetails = primaryEffects
    ? `${primaryEffects}で${primary.percentage}%`
    : `${primary.percentage}%`;
  const primaryApproximation = primary.approximate ? "・概算" : "";
  const separator = primary.approximate ? "／" : "・";
  const continuation = primaryEffects ? "さらに" : "";
  let alternativeDetails: string;

  if (alternative.kind === "guaranteed") {
    alternativeDetails = `${continuation}${alternativeEffects}で確定1発`;
  } else {
    const alternativeApproximation = alternative.approximate ? "・概算" : "";
    alternativeDetails =
      `${continuation}${alternativeEffects}では${alternative.percentage}%${alternativeApproximation}`;
  }

  return success(
    `乱数1発（${primaryDetails}${primaryApproximation}${separator}${alternativeDetails}）`,
  );
};

const parseAndTranslate = (sourceTextEn: string): ParseResult<string> => {
  const fullMatch = /^([^()]+?)(?:[ \t\r\n]+\(([^()]+)\))?$/.exec(sourceTextEn);
  if (!fullMatch) {
    return failure("unsupported-template");
  }

  const primary = parseClause(fullMatch[1]);
  if (!primary.ok) {
    return primary;
  }

  const alternativeSource = fullMatch[2];
  if (alternativeSource === undefined) {
    return success(formatStandaloneClause(primary.value));
  }

  const alternative = parseClause(alternativeSource);
  if (!alternative.ok) {
    return alternative;
  }

  return formatAlternative(primary.value, alternative.value);
};

const fallbackResult = (
  sourceTextEn: string,
  calcVersion: string,
  status: Exclude<SmogonKoReferenceTranslationStatus, "translated">,
): SmogonKoReferenceTranslation => ({
  sourceTextEn,
  displayText: sourceTextEn,
  status,
  isAuthoritative: false,
  calcVersion,
  templateProfile: TEMPLATE_PROFILE,
});

export const translateSmogonKoSourceTextJa = (
  sourceTextEn: string,
  calcVersion: string,
): SmogonKoReferenceTranslation => {
  if (sourceTextEn.trim().length === 0) {
    return fallbackResult(sourceTextEn, calcVersion, "source-empty");
  }

  if (calcVersion !== SUPPORTED_CALC_VERSION) {
    return fallbackResult(sourceTextEn, calcVersion, "unsupported-calc-version");
  }

  const translation = parseAndTranslate(sourceTextEn);
  if (!translation.ok) {
    return fallbackResult(sourceTextEn, calcVersion, translation.status);
  }

  return {
    sourceTextEn,
    referenceTextJa: translation.value,
    displayText: translation.value,
    status: "translated",
    isAuthoritative: false,
    calcVersion,
    templateProfile: TEMPLATE_PROFILE,
  };
};
