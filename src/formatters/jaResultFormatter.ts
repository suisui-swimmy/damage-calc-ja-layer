import type { CalcSideInput, DamageCalculationResult } from "../calc/smogonAdapter";
import type { EntityKind } from "../data/optionTypes";
import { getDisplayNameJa } from "../localization/resolver";

export interface JaEntityDisplay {
  canonicalName: string;
  displayNameJa: string;
}

export interface JaPokemonDisplay {
  name: JaEntityDisplay;
  level: number;
  item?: JaEntityDisplay;
  ability?: JaEntityDisplay;
  nature?: JaEntityDisplay;
  teraType?: JaEntityDisplay;
}

export interface JaMoveDisplay {
  name: JaEntityDisplay;
  type: JaEntityDisplay;
  category: string;
  categoryLabelJa: string;
  basePower: number;
}

export interface JaDamageDisplay {
  min: number;
  max: number;
  range: [number, number];
  rolls: number[];
  percentageRange?: {
    min: number;
    max: number;
    text: string;
  };
}

export interface JaKoChanceDisplay {
  chance?: number;
  turns: number;
  labelJa: string;
  sourceText: string;
}

export interface JaFieldDisplay {
  gameType: string;
  gameTypeLabelJa: string;
  weather?: {
    canonicalName: string;
    labelJa: string;
  };
  terrain?: {
    canonicalName: string;
    labelJa: string;
  };
  attackerSideConditions: string[];
  defenderSideConditions: string[];
}

export interface JaResultDetail {
  label: string;
  value: string;
  canonicalValue?: string;
}

export interface JaDamageResult {
  attackerNameJa: string;
  defenderNameJa: string;
  moveNameJa: string;
  damageRange: [number, number];
  attacker: JaPokemonDisplay;
  defender: JaPokemonDisplay;
  move: JaMoveDisplay;
  damage: JaDamageDisplay;
  field: JaFieldDisplay;
  koChance?: JaKoChanceDisplay;
  details: JaResultDetail[];
  summaryText: string;
  rawDescription: string;
  sourceDescription: string;
}

const categoryLabelsJa: Record<string, string> = {
  Physical: "物理",
  Special: "特殊",
  Status: "変化",
};

const gameTypeLabelsJa: Record<string, string> = {
  Singles: "シングル",
  Doubles: "ダブル",
};

const weatherLabelsJa: Record<string, string> = {
  Sun: "はれ",
  "Harsh Sunshine": "おおひざし",
  Rain: "あめ",
  "Heavy Rain": "おおあめ",
  Sand: "すなあらし",
  Hail: "あられ",
  Snow: "ゆき",
  "Strong Winds": "らんきりゅう",
};

const terrainLabelsJa: Record<string, string> = {
  Electric: "エレキフィールド",
  Grassy: "グラスフィールド",
  Misty: "ミストフィールド",
  Psychic: "サイコフィールド",
};

const sideConditionLabelsJa: Array<[keyof CalcSideInput, string]> = [
  ["isReflect", "リフレクター"],
  ["isLightScreen", "ひかりのかべ"],
  ["isProtected", "まもる"],
  ["isAuroraVeil", "オーロラベール"],
  ["isHelpingHand", "てだすけ"],
  ["isFriendGuard", "フレンドガード"],
  ["isBattery", "バッテリー"],
  ["isPowerSpot", "パワースポット"],
  ["isSteelySpirit", "はがねのせいしん"],
  ["isSR", "ステルスロック"],
];

const entityDisplay = (kind: EntityKind, canonicalName: string): JaEntityDisplay => ({
  canonicalName,
  displayNameJa: getDisplayNameJa(kind, canonicalName),
});

const optionalEntityDisplay = (
  kind: EntityKind,
  canonicalName?: string,
): JaEntityDisplay | undefined =>
  canonicalName ? entityDisplay(kind, canonicalName) : undefined;

const formatPercent = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toFixed(1).replace(/\.0$/, "")}%`;
};

const formatDamagePercentageRange = (
  percentageRange: DamageCalculationResult["damagePercentageRange"],
): JaDamageDisplay["percentageRange"] | undefined => {
  if (!percentageRange) {
    return undefined;
  }

  return {
    min: percentageRange.min,
    max: percentageRange.max,
    text: `${formatPercent(percentageRange.min)}-${formatPercent(percentageRange.max)}`,
  };
};

const formatKoChance = (
  koChance: DamageCalculationResult["koChance"],
): JaKoChanceDisplay | undefined => {
  if (!koChance) {
    return undefined;
  }

  const turnsText = koChance.turns > 0 ? `${koChance.turns}発` : "KO";
  let labelJa: string;

  if (koChance.chance === undefined) {
    labelJa = `${turnsText}の可能性`;
  } else if (koChance.chance === 1) {
    labelJa = `確定${turnsText}`;
  } else if (koChance.chance === 0) {
    labelJa = "撃破不可";
  } else {
    labelJa = `乱数${turnsText} (${formatPercent(koChance.chance * 100)})`;
  }

  return {
    chance: koChance.chance,
    turns: koChance.turns,
    labelJa,
    sourceText: koChance.sourceText,
  };
};

const sideConditionNames = (side: CalcSideInput): string[] => {
  const names = sideConditionLabelsJa
    .filter(([key]) => side[key] === true)
    .map(([, label]) => label);

  if (side.spikes !== undefined && side.spikes > 0) {
    names.push(`まきびし ${side.spikes}層`);
  }

  return names;
};

const addDetail = (
  details: JaResultDetail[],
  label: string,
  value?: string,
  canonicalValue?: string,
) => {
  if (!value) {
    return;
  }

  details.push({
    label,
    value,
    canonicalValue,
  });
};

export const formatDamageResultJa = (
  result: DamageCalculationResult,
): JaDamageResult => {
  const attacker: JaPokemonDisplay = {
    name: entityDisplay("pokemon", result.attacker.canonicalName),
    level: result.attacker.level,
    item: optionalEntityDisplay("item", result.attacker.item),
    ability: optionalEntityDisplay("ability", result.attacker.ability),
    nature: optionalEntityDisplay("nature", result.attacker.nature),
    teraType: optionalEntityDisplay("type", result.attacker.teraType),
  };
  const defender: JaPokemonDisplay = {
    name: entityDisplay("pokemon", result.defender.canonicalName),
    level: result.defender.level,
    item: optionalEntityDisplay("item", result.defender.item),
    ability: optionalEntityDisplay("ability", result.defender.ability),
    nature: optionalEntityDisplay("nature", result.defender.nature),
    teraType: optionalEntityDisplay("type", result.defender.teraType),
  };
  const move: JaMoveDisplay = {
    name: entityDisplay("move", result.move.canonicalName),
    type: entityDisplay("type", result.move.type),
    category: result.move.category,
    categoryLabelJa: categoryLabelsJa[result.move.category] ?? result.move.category,
    basePower: result.move.basePower,
  };
  const percentageRange = formatDamagePercentageRange(result.damagePercentageRange);
  const damage: JaDamageDisplay = {
    min: result.damageRange[0],
    max: result.damageRange[1],
    range: result.damageRange,
    rolls: result.damageRolls,
    percentageRange,
  };
  const field: JaFieldDisplay = {
    gameType: result.field.gameType,
    gameTypeLabelJa: gameTypeLabelsJa[result.field.gameType] ?? result.field.gameType,
    weather: result.field.weather
      ? {
          canonicalName: result.field.weather,
          labelJa: weatherLabelsJa[result.field.weather] ?? result.field.weather,
        }
      : undefined,
    terrain: result.field.terrain
      ? {
          canonicalName: result.field.terrain,
          labelJa: terrainLabelsJa[result.field.terrain] ?? result.field.terrain,
        }
      : undefined,
    attackerSideConditions: sideConditionNames(result.field.attackerSide),
    defenderSideConditions: sideConditionNames(result.field.defenderSide),
  };
  const koChance = formatKoChance(result.koChance);
  const attackerNameJa = attacker.name.displayNameJa;
  const defenderNameJa = defender.name.displayNameJa;
  const moveNameJa = move.name.displayNameJa;
  const [minDamage, maxDamage] = result.damageRange;
  const details: JaResultDetail[] = [];
  const damagePercentageText = percentageRange ? ` (${percentageRange.text})` : "";

  addDetail(details, "攻撃側", `${attackerNameJa} Lv.${attacker.level}`, attacker.name.canonicalName);
  addDetail(details, "防御側", `${defenderNameJa} Lv.${defender.level}`, defender.name.canonicalName);
  addDetail(details, "技", moveNameJa, move.name.canonicalName);
  addDetail(details, "技タイプ", move.type.displayNameJa, move.type.canonicalName);
  addDetail(details, "分類", move.categoryLabelJa, move.category);
  addDetail(details, "威力", String(move.basePower));
  addDetail(details, "攻撃側の持ち物", attacker.item?.displayNameJa, attacker.item?.canonicalName);
  addDetail(details, "攻撃側の特性", attacker.ability?.displayNameJa, attacker.ability?.canonicalName);
  addDetail(details, "攻撃側の性格", attacker.nature?.displayNameJa, attacker.nature?.canonicalName);
  addDetail(details, "攻撃側のテラスタイプ", attacker.teraType?.displayNameJa, attacker.teraType?.canonicalName);
  addDetail(details, "防御側の持ち物", defender.item?.displayNameJa, defender.item?.canonicalName);
  addDetail(details, "防御側の特性", defender.ability?.displayNameJa, defender.ability?.canonicalName);
  addDetail(details, "防御側の性格", defender.nature?.displayNameJa, defender.nature?.canonicalName);
  addDetail(details, "防御側のテラスタイプ", defender.teraType?.displayNameJa, defender.teraType?.canonicalName);
  addDetail(details, "ルール", field.gameTypeLabelJa, field.gameType);
  addDetail(details, "天候", field.weather?.labelJa, field.weather?.canonicalName);
  addDetail(details, "フィールド", field.terrain?.labelJa, field.terrain?.canonicalName);
  addDetail(details, "攻撃側の場", field.attackerSideConditions.join(" / "));
  addDetail(details, "防御側の場", field.defenderSideConditions.join(" / "));
  addDetail(details, "KO", koChance?.labelJa, koChance?.sourceText);

  return {
    attackerNameJa,
    defenderNameJa,
    moveNameJa,
    damageRange: result.damageRange,
    attacker,
    defender,
    move,
    damage,
    field,
    koChance,
    details,
    summaryText: `${attackerNameJa} の ${moveNameJa}: ${minDamage}-${maxDamage} ダメージ${damagePercentageText}`,
    rawDescription: result.rawDescription,
    sourceDescription: result.rawDescription,
  };
};
