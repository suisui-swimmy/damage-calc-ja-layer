export const CALC_SCENARIO_SCHEMA_VERSION = 1;

export type ScenarioWeather =
  | ""
  | "Sun"
  | "Rain"
  | "Sand"
  | "Snow"
  | "Harsh Sunshine"
  | "Heavy Rain"
  | "Strong Winds";

export type ScenarioTerrain = "" | "Electric" | "Grassy" | "Misty" | "Psychic";

export interface CalcScenarioShareState {
  schemaVersion: typeof CALC_SCENARIO_SCHEMA_VERSION;
  attacker: {
    pokemon: string;
    item: string;
    ability: string;
    nature: string;
  };
  defender: {
    pokemon: string;
  };
  move: {
    name: string;
  };
  field: {
    weather: ScenarioWeather;
    terrain: ScenarioTerrain;
    defenderLightScreen: boolean;
  };
}

export interface ParseCalcScenarioResult {
  ok: boolean;
  scenario?: CalcScenarioShareState;
  error?: string;
}

export const defaultCalcScenario: CalcScenarioShareState = {
  schemaVersion: CALC_SCENARIO_SCHEMA_VERSION,
  attacker: {
    pokemon: "ピカチュウ",
    item: "こだわりメガネ",
    ability: "せいでんき",
    nature: "ひかえめ",
  },
  defender: {
    pokemon: "ゼニガメ",
  },
  move: {
    name: "10万ボルト",
  },
  field: {
    weather: "",
    terrain: "",
    defenderLightScreen: false,
  },
};

const weatherValues: readonly ScenarioWeather[] = [
  "",
  "Sun",
  "Rain",
  "Sand",
  "Snow",
  "Harsh Sunshine",
  "Heavy Rain",
  "Strong Winds",
];

const terrainValues: readonly ScenarioTerrain[] = [
  "",
  "Electric",
  "Grassy",
  "Misty",
  "Psychic",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (record: Record<string, unknown>, key: string): string =>
  typeof record[key] === "string" ? record[key] : "";

const readBoolean = (record: Record<string, unknown>, key: string): boolean =>
  typeof record[key] === "boolean" ? record[key] : false;

const parseWeather = (value: string): ScenarioWeather =>
  weatherValues.includes(value as ScenarioWeather) ? (value as ScenarioWeather) : "";

const parseTerrain = (value: string): ScenarioTerrain =>
  terrainValues.includes(value as ScenarioTerrain) ? (value as ScenarioTerrain) : "";

const normalizeScenario = (value: unknown): CalcScenarioShareState | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.schemaVersion !== CALC_SCENARIO_SCHEMA_VERSION) {
    return undefined;
  }

  const attacker = isRecord(value.attacker) ? value.attacker : {};
  const defender = isRecord(value.defender) ? value.defender : {};
  const move = isRecord(value.move) ? value.move : {};
  const field = isRecord(value.field) ? value.field : {};

  return {
    schemaVersion: CALC_SCENARIO_SCHEMA_VERSION,
    attacker: {
      pokemon: readString(attacker, "pokemon"),
      item: readString(attacker, "item"),
      ability: readString(attacker, "ability"),
      nature: readString(attacker, "nature"),
    },
    defender: {
      pokemon: readString(defender, "pokemon"),
    },
    move: {
      name: readString(move, "name"),
    },
    field: {
      weather: parseWeather(readString(field, "weather")),
      terrain: parseTerrain(readString(field, "terrain")),
      defenderLightScreen: readBoolean(field, "defenderLightScreen"),
    },
  };
};

export const serializeCalcScenario = (scenario: CalcScenarioShareState): string =>
  JSON.stringify(scenario, null, 2);

export const parseCalcScenarioJson = (json: string): ParseCalcScenarioResult => {
  try {
    const parsed = JSON.parse(json);
    const scenario = normalizeScenario(parsed);

    if (!scenario) {
      return {
        ok: false,
        error: `schemaVersion ${CALC_SCENARIO_SCHEMA_VERSION} の計算条件JSONではありません`,
      };
    }

    return {
      ok: true,
      scenario,
    };
  } catch {
    return {
      ok: false,
      error: "JSONとして読み込めません",
    };
  }
};
