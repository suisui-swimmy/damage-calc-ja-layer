import { createRequire } from "node:module";
import {
  Field,
  Generations,
  Move,
  Pokemon,
  calculate,
  toID,
} from "@smogon/calc";

const require = createRequire(import.meta.url);
const calcPackage = require("@smogon/calc/package.json");
const gen = Generations.get(9);

const sample = (iterable, limit = 5) =>
  Array.from(iterable)
    .slice(0, limit)
    .map((entry) => entry.name);

const attacker = new Pokemon(gen, "Pikachu", {
  level: 50,
  nature: "Modest",
  item: "Choice Specs",
  evs: { spa: 252 },
});
const defender = new Pokemon(gen, "Squirtle", {
  level: 50,
  evs: { hp: 252 },
});
const move = new Move(gen, "Thunderbolt");
const field = new Field();
const result = calculate(gen, attacker, defender, move, field);

const report = {
  package: {
    name: calcPackage.name,
    version: calcPackage.version,
    license: calcPackage.license,
  },
  exportedApiChecked: [
    "Generations",
    "Pokemon",
    "Move",
    "Field",
    "calculate",
    "toID",
  ],
  generation: {
    num: gen.num,
    counts: {
      species: Array.from(gen.species).length,
      moves: Array.from(gen.moves).length,
      abilities: Array.from(gen.abilities).length,
      items: Array.from(gen.items).length,
      natures: Array.from(gen.natures).length,
      types: Array.from(gen.types).length,
    },
    sample: {
      species: sample(gen.species),
      moves: sample(gen.moves),
      abilities: sample(gen.abilities),
      items: sample(gen.items),
      natures: sample(gen.natures),
      types: sample(gen.types),
    },
  },
  lookupExamples: {
    pokemon: {
      input: "Pikachu",
      id: toID("Pikachu"),
      found: gen.species.get(toID("Pikachu"))?.name,
    },
    move: {
      input: "Thunderbolt",
      id: toID("Thunderbolt"),
      found: gen.moves.get(toID("Thunderbolt"))?.name,
    },
    item: {
      input: "Choice Specs",
      id: toID("Choice Specs"),
      found: gen.items.get(toID("Choice Specs"))?.name,
    },
  },
  calculationSmoke: {
    attacker: {
      name: attacker.name,
      item: attacker.item,
      nature: attacker.nature,
    },
    defender: {
      name: defender.name,
    },
    move: {
      name: move.name,
      type: move.type,
      category: move.category,
      bp: move.bp,
    },
    damage: result.damage,
    damageRange: result.range(),
    description: result.desc(),
  },
  adapterBoundaryNotes: [
    "Use resolver output canonical names as the only calc-facing keys.",
    "Keep damage formula, type chart, rolls, item and ability modifiers inside @smogon/calc.",
    "Keep Japanese search and display in localization / formatter modules.",
  ],
};

console.log(JSON.stringify(report, null, 2));
