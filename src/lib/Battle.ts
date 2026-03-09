import Army from "./Army";
import type Player from "./Player";
import type Graph from "./Graph";
import { armyAttackArmy, calculateUnitsNeeded } from "./Combat";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
export enum BattlePhase {
  AttackerTurn = "attacker_turn",
  DefenderTurn = "defender_turn",
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
export enum BattleResult {
  Ongoing = "ongoing",
  AttackerWins = "attacker_wins",
  DefenderWins = "defender_wins",
  Retreat = "retreat",
  Draw = "draw",
}

export interface AttackAllocation {
  target: Army;
  unitCount: number;
}

class Battle {
  // Config
  public targetLocation: string;
  public graph: Graph;
  public maxRounds: number;

  // Participants
  public attackerPlayer: Player;
  public defenderPlayer: Player;
  public attackerArmies: Army[];
  public defenderArmies: Army[];

  // State
  public round: number;
  public phase: BattlePhase;
  public result: BattleResult;
  public actedArmies: Set<Army>;

  constructor(
    targetLocation: string,
    attackerPlayer: Player,
    defenderPlayer: Player,
    attackerArmies: Army[],
    graph: Graph,
    maxRounds: number,
  ) {
    // Config
    this.targetLocation = targetLocation;
    this.graph = graph;
    this.maxRounds = maxRounds;

    // Participants
    this.attackerPlayer = attackerPlayer;
    this.defenderPlayer = defenderPlayer;
    this.attackerArmies = [...attackerArmies];
    this.defenderArmies = defenderPlayer.armies.filter(
      (army) => army.location === targetLocation,
    );

    // State
    this.round = 1;
    this.phase = BattlePhase.AttackerTurn;
    this.result = BattleResult.Ongoing;
    this.actedArmies = new Set();
  }

  get currentArmies(): Army[] {
    return this.phase === BattlePhase.AttackerTurn
      ? this.attackerArmies
      : this.defenderArmies;
  }

  get unactedArmies(): Army[] {
    return this.currentArmies.filter((army) => !this.actedArmies.has(army));
  }

  get hasActableArmies(): boolean {
    return this.unactedArmies.some(
      army => this.getTargetsInRange(army).length > 0
    );
  }

  canAct(army: Army): boolean {
    if (this.result !== BattleResult.Ongoing) return false;
    if (this.actedArmies.has(army)) return false;
    if (!this.currentArmies.includes(army)) return false;
    return true;
  }

  getTargetsInRange(army: Army): Army[] {
    if (this.attackerArmies.includes(army)) {
      const distance = this.graph.getDistance(
        army.location,
        this.targetLocation,
      );
      if (army.unitStats.range >= distance) {
        return this.defenderArmies;
      }
      return [];
    } else if (this.defenderArmies.includes(army)) {
      return this.attackerArmies.filter((attackerArmy) => {
        const distance = this.graph.getDistance(
          this.targetLocation,
          attackerArmy.location,
        );
        return army.unitStats.range >= distance;
      });
    } else {
      return [];
    }
  }

  getUnitsNeeded(attackerArmy: Army, targetArmy: Army): number {
    return calculateUnitsNeeded(attackerArmy, targetArmy);
  }

  allocateAttack(army: Army, allocations: AttackAllocation[]): boolean {
    if (!this.canAct(army)) return false;

    if (!allocations.every((alloc) => alloc.unitCount > 0)) return false;

    const targetSet = new Set(allocations.map((alloc) => alloc.target));
    if (targetSet.size !== allocations.length) return false;

    const targetsInRange = this.getTargetsInRange(army);
    if (!allocations.every((alloc) => targetsInRange.includes(alloc.target))) return false;

    let totalAllocated = 0;
    for (const alloc of allocations) {
      totalAllocated += alloc.unitCount;
    }
    if (totalAllocated > army.units.length) return false;

    for (const { target, unitCount } of allocations) {
      armyAttackArmy(army, target, unitCount);
    }

    this.actedArmies.add(army);
    this.cleanupDeadArmies();
    this.checkBattleEnd();
    if (this.result === BattleResult.Ongoing && !this.hasActableArmies) {
      this.endPhase();
    }
    return true;
  }

  retreat(): boolean {
    if (this.result !== BattleResult.Ongoing) return false;
    if (this.phase !== BattlePhase.AttackerTurn) return false;
    if (this.actedArmies.size > 0) return false;

    this.result = BattleResult.Retreat;
    return true;
  }

  executeNeutralDefenderTurn(): void {
    if (this.phase !== BattlePhase.DefenderTurn) return;

    function findHighestHpArmy(armies: Army[]): Army {
      let target = armies[0];
      let maxHp = 0;
      for (const unit of target.units) {
        maxHp += unit.currentHealth;
      }

      for (const candidate of armies) {
        let candidateHp = 0;
        for (const unit of candidate.units) {
          candidateHp += unit.currentHealth;
        }
        if (candidateHp > maxHp) {
          target = candidate;
          maxHp = candidateHp;
        }
      }
      return target;
    }

    for (const army of this.unactedArmies) {
      const targets = this.getTargetsInRange(army);
      if (targets.length === 0) continue;
      const target = findHighestHpArmy(targets);

      this.allocateAttack(army, [{ target, unitCount: army.units.length }]);
      if (this.result !== BattleResult.Ongoing) return;
    }
  }

  private endPhase(): boolean {
    if (this.result !== BattleResult.Ongoing) return false;
    if (this.hasActableArmies) return false;

    this.actedArmies.clear();

    if (this.phase === BattlePhase.AttackerTurn) {
      this.phase = BattlePhase.DefenderTurn;
    } else {
      this.round++;
      if (this.round > this.maxRounds) {
        this.result = BattleResult.Draw;
        return true;
      }
      this.phase = BattlePhase.AttackerTurn;
    }

    if (!this.hasActableArmies) {
      this.endPhase();
    }
    return true;
  }

  private checkBattleEnd(): void {
    const attackersAlive = this.attackerArmies.length > 0;
    const defendersAlive = this.defenderArmies.length > 0;

    if (!defendersAlive) {
      this.result = BattleResult.AttackerWins;
    } else if (!attackersAlive) {
      this.result = BattleResult.DefenderWins;
    }
  }

  private cleanupDeadArmies(): void {
    this.attackerArmies = this.attackerArmies.filter(
      (army) => army.units.length > 0,
    );
    this.defenderArmies = this.defenderArmies.filter(
      (army) => army.units.length > 0,
    );
  }

  toJSON(): BattleSave {
    return {
      targetLocation: this.targetLocation,
      attackerPlayer: this.attackerPlayer.name,
      defenderPlayer: this.defenderPlayer.name,
      attackerArmies: this.attackerArmies.map((a) => this.attackerPlayer.armies.indexOf(a)),
      defenderArmies: this.defenderArmies.map((a) => this.defenderPlayer.armies.indexOf(a)),
      round: this.round,
      phase: this.phase,
      result: this.result,
      actedAttackerArmies: this.attackerArmies
        .filter((a) => this.actedArmies.has(a))
        .map((a) => this.attackerPlayer.armies.indexOf(a)),
      actedDefenderArmies: this.defenderArmies
        .filter((a) => this.actedArmies.has(a))
        .map((a) => this.defenderPlayer.armies.indexOf(a)),
    };
  }

  static fromJSON(
    json: BattleSave,
    players: Player[],
    graph: Graph,
    maxRounds: number,
  ): Battle {
    const attackerPlayer = players.find((p) => p.name === json.attackerPlayer)!;
    const defenderPlayer = players.find((p) => p.name === json.defenderPlayer)!;
    const battle = new Battle(
      json.targetLocation,
      attackerPlayer,
      defenderPlayer,
      json.attackerArmies.map((i) => attackerPlayer.armies[i]),
      graph,
      maxRounds,
    );
    battle.defenderArmies = json.defenderArmies.map((i) => defenderPlayer.armies[i]);
    battle.round = json.round;
    battle.phase = json.phase;
    battle.result = json.result;
    battle.actedArmies = new Set([
      ...json.actedAttackerArmies.map((i) => attackerPlayer.armies[i]),
      ...json.actedDefenderArmies.map((i) => defenderPlayer.armies[i]),
    ]);
    return battle;
  }
}

export interface BattleSave {
  targetLocation: string;
  attackerPlayer: string;
  defenderPlayer: string;
  attackerArmies: number[];
  defenderArmies: number[];
  round: number;
  phase: BattlePhase;
  result: BattleResult;
  actedAttackerArmies: number[];
  actedDefenderArmies: number[];
}

export default Battle;
