import type {UnitStats, UnitType, UnitJSON} from "./Unit";
import Unit from "./Unit";
import Graph from "./Graph";

class Army {
  public units: Unit[];
  public unitType: UnitType;
  public unitStats: UnitStats;
  public location: string;
  public remainingMoves: number;
  public canAttack: boolean;

  constructor(unitType: UnitType, unitStats: UnitStats, location: string, count: number = 0) {
    this.units = [];
    this.unitType = unitType;
    this.unitStats = unitStats;
    this.location = location;
    this.remainingMoves = 0;
    this.canAttack = false;
    this.addUnits(count);
  }

  public addUnits(count: number) {
    if (count <= 0) return;
    for (let i = 0; i < count; i++) {
      this.units.push(new Unit(this.unitStats));
    }
  }

  public removeDeadUnits() {
    this.units = this.units.filter(unit => unit.currentHealth > 0);
  }

  public getMovableLocations(graph: Graph, blockedLocations: Set<string>): string[] {
    return Array.from(graph.nodes.keys())
      .filter(location => this.canMove(location, graph, blockedLocations));
  }

  public canMove(newLocation: string, graph: Graph, blockedLocations: Set<string>): boolean {
    if (newLocation === this.location || blockedLocations.has(newLocation)) {
      return false;
    }
    const distance = graph.getDistance(this.location, newLocation, blockedLocations);
    return distance <= this.remainingMoves;
  }

  public getAttackableTargets(enemies: Army[], graph: Graph): Army[] {
    if (!this.canAttack) {
      return [];
    }
    return enemies.filter(enemy =>
      graph.getDistance(this.location, enemy.location) <= this.unitStats.range
    );
  }

  public resetTurn() {
    this.remainingMoves = this.unitStats.speed;
    this.canAttack = true;
  }

  toJSON(): ArmyJSON {
    return {
      unitType: this.unitType as string,
      location: this.location,
      remainingMoves: this.remainingMoves,
      canAttack: this.canAttack,
      units: this.units.map(unit => unit.toJSON()),
    };
  }

  static fromJSON(json: ArmyJSON, unitStatsMap: Record<string, UnitStats>): Army {
    const stats = unitStatsMap[json.unitType];
    const army = new Army(json.unitType, stats, json.location);
    army.remainingMoves = json.remainingMoves;
    army.canAttack = json.canAttack;
    army.units = json.units.map(unitJSON => Unit.fromJSON(unitJSON, stats));
    return army;
  }
}

export interface ArmyJSON {
  unitType: string;
  location: string;
  remainingMoves: number;
  canAttack: boolean;
  units: UnitJSON[];
}

export default Army;
