import Army from "./Army";
import type {ArmyJSON} from "./Army";
import Graph from "./Graph";
import type {UnitStatsMap, UnitType} from "./Unit";

class Player {
  public money: number;
  public name: string;
  public homeLocation: string;
  public unitStatsMap: UnitStatsMap = {};
  public armies: Army[] = [];
  public defeated = false;

  constructor(money: number, name: string, homeLocation: string) {
    this.money = money;
    this.name = name;
    this.homeLocation = homeLocation;
  }

  public canBuy(unitType: UnitType, count: number): boolean {
    if (count <= 0) return false;
    return this.money >= this.unitStatsMap[unitType].cost * count;
  }

  public getUpkeep(upkeepRate: number): number {
    let total = 0;
    for (const army of this.armies) {
      total += army.units.length * army.unitStats.cost * upkeepRate;
    }
    return Math.floor(total);
  }

  public buyUnitsToLocation(unitType: UnitType, location: string, count: number): Army | null {
    if (count <= 0) return null;
    if (!this.canBuy(unitType, count)) return null;

    const stats = this.unitStatsMap[unitType];
    const army = new Army(unitType, stats, location, count);
    this.armies.push(army);
    this.money -= army.unitStats.cost * count;
    return army;
  }

  public moveArmy(army: Army, newLocation: string, graph: Graph, enemyLocations: Set<string>): boolean {
    if (!army.canMove(newLocation, graph, enemyLocations)) return false;

    const distance = graph.getDistance(army.location, newLocation, enemyLocations);
    army.remainingMoves -= distance;
    army.location = newLocation;
    return true;
  }

  public splitArmy(army: Army, count: number): Army | null {
    if (!this.armies.includes(army)) return null;
    if (count <= 0 || count >= army.units.length) return null;

    const stats = this.unitStatsMap[army.unitType];
    const newArmy = new Army(army.unitType, stats, army.location);
    newArmy.units = army.units.splice(army.units.length - count, count);
    newArmy.remainingMoves = army.remainingMoves;
    newArmy.canAttack = army.canAttack;
    this.armies.push(newArmy);
    return newArmy;
  }

  public mergeArmies(target: Army, source: Army): Army | null {
    if (target === source) return null;
    if (!this.armies.includes(target) || !this.armies.includes(source)) return null;
    if (target.unitType !== source.unitType) return null;
    if (target.location !== source.location) return null;

    for (const u of source.units) target.units.push(u);
    target.remainingMoves = Math.min(target.remainingMoves, source.remainingMoves);
    target.canAttack = target.canAttack && source.canAttack;
    this.armies = this.armies.filter(a => a !== source);
    return target;
  }

  public disbandUnits(army: Army, count: number): boolean {
    if (!this.armies.includes(army) || count <= 0) return false;

    const toRemove = Math.min(count, army.units.length);
    army.units.splice(army.units.length - toRemove, toRemove);
    this.removeEmptyArmies();
    return true;
  }

  public resetAllArmyTurns() {
    for (const army of this.armies) {
      army.resetTurn();
    }
  }

  public removeEmptyArmies() {
    this.armies = this.armies.filter(army => army.units.length > 0);
  }

  toJSON(): PlayerJSON {
    return {
      name: this.name,
      money: this.money,
      homeLocation: this.homeLocation,
      defeated: this.defeated,
      armies: this.armies.map(army => army.toJSON()),
    };
  }

  static fromJSON(json: PlayerJSON, unitStatsMap: UnitStatsMap): Player {
    const player = new Player(json.money, json.name, json.homeLocation);
    player.defeated = json.defeated;
    player.unitStatsMap = unitStatsMap;
    player.armies = json.armies.map(armyJSON => Army.fromJSON(armyJSON, unitStatsMap));
    return player;
  }
}

export interface PlayerJSON {
  name: string;
  money: number;
  homeLocation: string;
  defeated: boolean;
  armies: ArmyJSON[];
}

export default Player;
