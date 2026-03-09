export interface UnitStats {
  attack: number;
  defend: number;
  health: number;
  range: number;
  speed: number;
  cost: number;
}

export type UnitStatsMap = Record<string, UnitStats>;

export type UnitType = keyof UnitStatsMap;

class Unit {
  public readonly attack: number;
  public readonly defend: number;
  public readonly health: number;
  public readonly range: number;
  public readonly speed: number;
  public readonly cost: number;
  public currentHealth: number;

  constructor(stats: UnitStats) {
    this.attack = stats.attack;
    this.defend = stats.defend;
    this.health = stats.health;
    this.range = stats.range;
    this.speed = stats.speed;
    this.cost = stats.cost;
    this.currentHealth = stats.health;
  }

  toJSON(): UnitJSON {
    return { currentHealth: this.currentHealth };
  }

  static fromJSON(json: UnitJSON, stats: UnitStats): Unit {
    const unit = new Unit(stats);
    unit.currentHealth = json.currentHealth;
    return unit;
  }
}

export interface UnitJSON {
  currentHealth: number;
}

export default Unit;
