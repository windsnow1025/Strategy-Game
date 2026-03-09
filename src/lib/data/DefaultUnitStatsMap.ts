import type {UnitStats} from "../Unit";

const DefaultUnitStatsMap = {
  Infantry: { attack: 7, defend: 2, health: 10, range: 1, speed: 1, cost: 1 },
  Archer:   { attack: 5, defend: 1, health: 10, range: 2, speed: 1, cost: 1 },
  Cavalry:  { attack: 9, defend: 3, health: 20, range: 1, speed: 2, cost: 2 },
} as const satisfies Record<string, UnitStats>;

export type DefaultUnitName = keyof typeof DefaultUnitStatsMap;

export default DefaultUnitStatsMap;
