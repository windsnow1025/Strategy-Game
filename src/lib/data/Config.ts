import DefaultGameMap from "./DefaultGameMap.ts";
import DefaultNeutralGarrison from "./DefaultNeutralGarrison.ts";
import DefaultPlayers from "./DefaultPlayers.ts";
import DefaultUnitStatsMap from "./DefaultUnitStatsMap.ts";
import type {GameConfig} from "../Config.ts";

const Config: GameConfig = {
  unitStatsMap: DefaultUnitStatsMap,
  gameMap: DefaultGameMap,
  maxTurns: 100,
  maxBattleRounds: 10,
  interestRate: 0.05,
  upkeepRate: 0.1,
  players: DefaultPlayers,
  neutralGarrison: DefaultNeutralGarrison,
};

export default Config;
