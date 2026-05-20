import type { DamageCalculationResult } from "../calc/smogonAdapter";
import { getDisplayNameJa } from "../localization/resolver";

export interface JaDamageResult {
  attackerNameJa: string;
  defenderNameJa: string;
  moveNameJa: string;
  damageRange: [number, number];
  summaryText: string;
  sourceDescription: string;
}

export const formatDamageResultJa = (
  result: DamageCalculationResult,
): JaDamageResult => {
  const attackerNameJa = getDisplayNameJa("pokemon", result.attacker.canonicalName);
  const defenderNameJa = getDisplayNameJa("pokemon", result.defender.canonicalName);
  const moveNameJa = getDisplayNameJa("move", result.move.canonicalName);
  const [minDamage, maxDamage] = result.damageRange;

  return {
    attackerNameJa,
    defenderNameJa,
    moveNameJa,
    damageRange: result.damageRange,
    summaryText: `${attackerNameJa} の ${moveNameJa}: ${minDamage}-${maxDamage} ダメージ`,
    sourceDescription: result.description,
  };
};
