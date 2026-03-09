import DefaultUnitStatsMap, {type DefaultUnitName} from "./DefaultUnitStatsMap.ts";

const unitType: DefaultUnitName = "Infantry";
const unitStatsMap = DefaultUnitStatsMap;

const DefaultNeutralGarrison = {
  unitType: unitType,
  unitStats: unitStatsMap.Infantry,
} as const;

export default DefaultNeutralGarrison;