import {type UnitStats, type UnitStatsMap, type UnitType} from "./Unit.ts";
import type Graph from "./Graph.ts";
import Player from "./Player.ts";

export interface NeutralGarrison {
  unitType: UnitType;
  unitStats: UnitStats;
}

export interface GameConfig {
  unitStatsMap: UnitStatsMap;
  gameMap: Graph;
  maxTurns: number;
  maxBattleRounds: number;
  interestRate: number;
  upkeepRate: number;
  players: Player[];
  neutralGarrison: NeutralGarrison;
}
