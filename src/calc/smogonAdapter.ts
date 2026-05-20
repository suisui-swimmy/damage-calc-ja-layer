import { Field, Generations, Move, Pokemon, calculate } from "@smogon/calc";
import calcPackage from "@smogon/calc/package.json";

export interface StatTable {
  hp?: number;
  atk?: number;
  def?: number;
  spa?: number;
  spd?: number;
  spe?: number;
}

export interface CalcPokemonInput {
  name: string;
  level?: number;
  item?: string;
  ability?: string;
  nature?: string;
  evs?: StatTable;
  ivs?: StatTable;
  boosts?: Omit<StatTable, "hp">;
}

export interface CalcMoveInput {
  name: string;
  isCrit?: boolean;
}

export interface CalcFieldInput {
  gameType?: "Singles" | "Doubles";
}

export interface DamageCalculationInput {
  attacker: CalcPokemonInput;
  defender: CalcPokemonInput;
  move: CalcMoveInput;
  field?: CalcFieldInput;
}

export interface DamageCalculationResult {
  damageRolls: number[];
  damageRange: [number, number];
  description: string;
  attacker: {
    canonicalName: string;
    item?: string;
  };
  defender: {
    canonicalName: string;
  };
  move: {
    canonicalName: string;
  };
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

export const getSmogonCalcVersion = (): string => calcPackage.version;

export const calculateDamage = (
  input: DamageCalculationInput,
): DamageCalculationResult => {
  const attacker = new Pokemon(generation, input.attacker.name, {
    level: input.attacker.level ?? 50,
    item: input.attacker.item,
    ability: input.attacker.ability,
    nature: input.attacker.nature,
    evs: input.attacker.evs,
    ivs: input.attacker.ivs,
    boosts: input.attacker.boosts,
  });
  const defender = new Pokemon(generation, input.defender.name, {
    level: input.defender.level ?? 50,
    item: input.defender.item,
    ability: input.defender.ability,
    nature: input.defender.nature,
    evs: input.defender.evs,
    ivs: input.defender.ivs,
    boosts: input.defender.boosts,
  });
  const move = new Move(generation, input.move.name, {
    isCrit: input.move.isCrit,
  });
  const field = new Field({
    gameType: input.field?.gameType ?? "Singles",
  });
  const result = calculate(generation, attacker, defender, move, field);
  const damageRolls = flattenDamage(result.damage);

  if (damageRolls.length === 0) {
    throw new Error("No numeric damage rolls returned by @smogon/calc");
  }

  return {
    damageRolls,
    damageRange: [Math.min(...damageRolls), Math.max(...damageRolls)],
    description: result.desc(),
    attacker: {
      canonicalName: attacker.name,
      item: attacker.item,
    },
    defender: {
      canonicalName: defender.name,
    },
    move: {
      canonicalName: move.name,
    },
  };
};
