import { Field, Generations, Move, Pokemon, calculate, toID } from "@smogon/calc";
import calcPackage from "@smogon/calc/package.json";
import type { GenerationNum, StatID, StatsTable, State } from "@smogon/calc";

export type StatTable = Partial<StatsTable>;
export type BoostTable = Partial<Record<Exclude<StatID, "hp">, number>>;

export interface CalcPokemonInput {
  canonicalName: string;
  level?: number;
  item?: string;
  ability?: string;
  nature?: string;
  evs?: StatTable;
  ivs?: StatTable;
  boosts?: BoostTable;
  teraType?: State.Pokemon["teraType"];
  curHP?: number;
}

export interface CalcMoveInput {
  canonicalName: string;
  isCrit?: boolean;
  hits?: number;
}

export interface CalcSideInput {
  isReflect?: boolean;
  isLightScreen?: boolean;
  isProtected?: boolean;
  isAuroraVeil?: boolean;
  isHelpingHand?: boolean;
  isFriendGuard?: boolean;
  isBattery?: boolean;
  isPowerSpot?: boolean;
  isSteelySpirit?: boolean;
  isSR?: boolean;
  spikes?: number;
}

export interface CalcFieldInput {
  gameType?: State.Field["gameType"];
  weather?: State.Field["weather"];
  terrain?: State.Field["terrain"];
  attackerSide?: CalcSideInput;
  defenderSide?: CalcSideInput;
}

export interface DamageCalculationInput {
  attacker: CalcPokemonInput;
  defender: CalcPokemonInput;
  move: CalcMoveInput;
  field?: CalcFieldInput;
}

export interface CalcPokemonResultSummary {
  canonicalName: string;
  level: number;
  item?: string;
  ability?: string;
  nature: string;
  teraType?: State.Pokemon["teraType"];
  stats: StatsTable;
}

export interface CalcMoveResultSummary {
  canonicalName: string;
  type: string;
  category: string;
  basePower: number;
}

export interface CalcFieldResultSummary {
  gameType: State.Field["gameType"];
  weather?: State.Field["weather"];
  terrain?: State.Field["terrain"];
  attackerSide: CalcSideInput;
  defenderSide: CalcSideInput;
}

export interface DamagePercentageRange {
  min: number;
  max: number;
  notation: "%";
}

export interface KoChanceSummary {
  chance?: number;
  turns: number;
  sourceText: string;
}

export interface DamageCalculationResult {
  generation: GenerationNum;
  calcVersion: string;
  damageRolls: number[];
  damageRange: [number, number];
  damagePercentageRange?: DamagePercentageRange;
  koChance?: KoChanceSummary;
  rawDescription: string;
  attacker: CalcPokemonResultSummary;
  defender: CalcPokemonResultSummary;
  move: CalcMoveResultSummary;
  field: CalcFieldResultSummary;
}

const generation = Generations.get(9);

const flattenDamage = (damage: unknown): number[] => {
  if (typeof damage === "number") {
    return [damage];
  }
  if (Array.isArray(damage)) {
    return damage.flat(Infinity).filter((value): value is number => typeof value === "number");
  }
  return [];
};

const sideSummary = (side: Field["attackerSide"]): CalcSideInput => ({
  isReflect: side.isReflect,
  isLightScreen: side.isLightScreen,
  isProtected: side.isProtected,
  isAuroraVeil: side.isAuroraVeil,
  isHelpingHand: side.isHelpingHand,
  isFriendGuard: side.isFriendGuard,
  isBattery: side.isBattery,
  isPowerSpot: side.isPowerSpot,
  isSteelySpirit: side.isSteelySpirit,
  isSR: side.isSR,
  spikes: side.spikes,
});

const assertKnownCanonical = (
  kind: "pokemon" | "move" | "item" | "ability" | "nature" | "type",
  canonicalName: string,
  role: string,
) => {
  const id = toID(canonicalName);
  const catalog = {
    pokemon: generation.species,
    move: generation.moves,
    item: generation.items,
    ability: generation.abilities,
    nature: generation.natures,
    type: generation.types,
  }[kind];

  if (!catalog.get(id)) {
    throw new Error(`Unknown ${role} canonical ${kind}: ${canonicalName}`);
  }
};

const buildPokemon = (role: "attacker" | "defender", input: CalcPokemonInput) => {
  assertKnownCanonical("pokemon", input.canonicalName, role);
  if (input.item) {
    assertKnownCanonical("item", input.item, `${role} item`);
  }
  if (input.ability) {
    assertKnownCanonical("ability", input.ability, `${role} ability`);
  }
  if (input.nature) {
    assertKnownCanonical("nature", input.nature, `${role} nature`);
  }
  if (input.teraType) {
    assertKnownCanonical("type", input.teraType, `${role} teraType`);
  }

  return new Pokemon(generation, input.canonicalName, {
    level: input.level ?? 50,
    item: input.item,
    ability: input.ability,
    nature: input.nature,
    evs: input.evs,
    ivs: input.ivs,
    boosts: input.boosts,
    teraType: input.teraType,
    curHP: input.curHP,
  });
};

const buildMove = (input: CalcMoveInput) => {
  assertKnownCanonical("move", input.canonicalName, "move");

  return new Move(generation, input.canonicalName, {
    isCrit: input.isCrit,
    hits: input.hits,
  });
};

const buildField = (input?: CalcFieldInput) =>
  new Field({
    gameType: input?.gameType ?? "Singles",
    weather: input?.weather,
    terrain: input?.terrain,
    attackerSide: input?.attackerSide,
    defenderSide: input?.defenderSide,
  });

const toDamagePercentageRange = (
  [minDamage, maxDamage]: [number, number],
  defenderMaxHp: number,
): DamagePercentageRange | undefined => {
  if (defenderMaxHp <= 0) {
    return undefined;
  }

  return {
    min: Math.floor((minDamage * 1000) / defenderMaxHp) / 10,
    max: Math.floor((maxDamage * 1000) / defenderMaxHp) / 10,
    notation: "%",
  };
};

const summarizeKoChance = (
  koChance: ReturnType<ReturnType<typeof calculate>["kochance"]>,
): KoChanceSummary | undefined => {
  if (koChance.n === 0 && !koChance.text) {
    return undefined;
  }

  return {
    chance: koChance.chance,
    turns: koChance.n,
    sourceText: koChance.text,
  };
};

export const getSmogonCalcVersion = (): string => calcPackage.version;

export const calculateDamage = (
  input: DamageCalculationInput,
): DamageCalculationResult => {
  const attacker = buildPokemon("attacker", input.attacker);
  const defender = buildPokemon("defender", input.defender);
  const move = buildMove(input.move);
  const field = buildField(input.field);
  const result = calculate(generation, attacker, defender, move, field);
  const damageRolls = flattenDamage(result.damage);
  const damageRange = result.range();

  if (damageRolls.length === 0) {
    throw new Error("No numeric damage rolls returned by @smogon/calc");
  }

  return {
    generation: generation.num,
    calcVersion: getSmogonCalcVersion(),
    damageRolls,
    damageRange,
    damagePercentageRange: toDamagePercentageRange(damageRange, defender.maxHP()),
    koChance: summarizeKoChance(result.kochance(false)),
    rawDescription: result.desc(),
    attacker: {
      canonicalName: attacker.name,
      level: attacker.level,
      item: attacker.item,
      ability: attacker.ability,
      nature: attacker.nature,
      teraType: attacker.teraType,
      stats: attacker.stats,
    },
    defender: {
      canonicalName: defender.name,
      level: defender.level,
      item: defender.item,
      ability: defender.ability,
      nature: defender.nature,
      teraType: defender.teraType,
      stats: defender.stats,
    },
    move: {
      canonicalName: move.name,
      type: move.type,
      category: move.category,
      basePower: move.bp,
    },
    field: {
      gameType: field.gameType,
      weather: field.weather,
      terrain: field.terrain,
      attackerSide: sideSummary(field.attackerSide),
      defenderSide: sideSummary(field.defenderSide),
    },
  };
};
