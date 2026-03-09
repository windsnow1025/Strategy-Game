import Player, {type PlayerJSON} from "./Player";
import Army from "./Army";
import Battle, {BattleResult, type BattleSave} from "./Battle";
import type {UnitStatsMap, UnitType} from "./Unit";
import Graph, {type GraphJSON} from "./Graph.ts";
import type {GameConfig} from "./Config.ts";

class GameSystem {
  // Config
  public unitStatsMap: UnitStatsMap;
  public gameMap: Graph;
  public maxTurns: number;
  public maxBattleRounds: number;
  public interestRate: number;
  public upkeepRate: number;

  // Participants
  public players: Player[];
  public neutralPlayer: Player;

  // State
  public nodeOwnership: Map<string, Player | null> = new Map<string, Player | null>();
  public currentPlayerIndex = 0;
  public turnCount = 1;
  public currentBattle: Battle | null = null;

  constructor(config: GameConfig) {
    this.unitStatsMap = structuredClone(config.unitStatsMap);
    this.gameMap = Graph.fromJSON(config.gameMap.toJSON());
    this.players = config.players.map(p => new Player(p.money, p.name, p.homeLocation));
    this.maxTurns = config.maxTurns;
    this.maxBattleRounds = config.maxBattleRounds;
    this.interestRate = config.interestRate;
    this.upkeepRate = config.upkeepRate;

    // Neutral Player
    this.neutralPlayer = new Player(0, "Neutral", "");

    // Unit Stats Map for all Players
    for (const player of this.players) {
      player.unitStatsMap = this.unitStatsMap;
    }
    this.neutralPlayer.unitStatsMap = this.unitStatsMap;

    // Node Ownership
    for (const name of this.gameMap.nodes.keys()) {
      this.nodeOwnership.set(name, null);
    }
    for (const player of this.players) {
      this.nodeOwnership.set(player.homeLocation, player);
    }

    // Neutral Garrison
    const garrisonStats = structuredClone(config.neutralGarrison.unitStats);
    for (const [name, entry] of this.gameMap.nodes) {
      if (this.nodeOwnership.get(name) === null) {
        const army = new Army(
          config.neutralGarrison.unitType, garrisonStats, name, entry.data.income
        );
        this.neutralPlayer.armies.push(army);
      }
    }

    this.startTurn();
  }

  get allPlayers(): Player[] {
    return [...this.players, this.neutralPlayer];
  }

  get currentPlayer(): Player {
    return this.players[this.currentPlayerIndex];
  }

  get activePlayers(): Player[] {
    return this.players.filter(p => !p.defeated);
  }

  get winner(): Player | null {
    const active = this.activePlayers;
    return active.length === 1 ? active[0] : null;
  }

  get isDraw(): boolean {
    return this.turnCount >= this.maxTurns && this.winner === null;
  }

  get gameOver(): boolean {
    return this.winner !== null || this.isDraw;
  }

  get nodeIncome(): number {
    let income = 0;
    for (const [node, owner] of this.nodeOwnership) {
      if (owner === this.currentPlayer) {
        income += this.gameMap.getNodeData(node)!.income;
      }
    }
    return income;
  }

  get recruitLocations(): string[] {
    const locations: string[] = [];
    for (const [node, owner] of this.nodeOwnership) {
      if (owner === this.currentPlayer && this.gameMap.getNodeData(node)!.canRecruit) {
        locations.push(node);
      }
    }
    return locations;
  }

  get enemyLocations(): Set<string> {
    const locations = new Set<string>();
    for (const player of this.allPlayers) {
      if (player === this.currentPlayer) continue;
      for (const army of player.armies) {
        locations.add(army.location);
      }
    }
    return locations;
  }

  maxArmiesPerTypeAtNode(location: string): number {
    return this.gameMap.getNeighborCount(location) + 1;
  }

  countArmiesOfTypeAtLocation(player: Player, unitType: UnitType, location: string): number {
    let n = 0;
    for (const a of player.armies) {
      if (a.location === location && a.unitType === unitType) n++;
    }
    return n;
  }

  recruitPlayerArmy(unitType: UnitType, location: string, count: number): Army | null {
    if (this.gameOver || this.currentPlayer.defeated) return null;
    if (this.currentBattle) return null;
    if (!this.gameMap.getNodeData(location)!.canRecruit) return null;
    if (this.nodeOwnership.get(location) !== this.currentPlayer) return null;
    if (this.countArmiesOfTypeAtLocation(this.currentPlayer, unitType, location) >= this.maxArmiesPerTypeAtNode(location)) return null;

    return this.currentPlayer.buyUnitsToLocation(unitType, location, count);
  }

  movePlayerArmy(army: Army, newLocation: string): boolean {
    if (this.gameOver || this.currentPlayer.defeated) return false;
    if (this.currentBattle) return false;

    const result = this.currentPlayer.moveArmy(army, newLocation, this.gameMap, this.enemyLocations);
    if (result) {
      this.nodeOwnership.set(newLocation, this.currentPlayer);
      this.checkDefeat();
    }
    return result;
  }

  splitPlayerArmy(army: Army, count: number): Army | null {
    if (this.gameOver || this.currentPlayer.defeated) return null;
    if (this.currentBattle) return null;
    if (this.countArmiesOfTypeAtLocation(this.currentPlayer, army.unitType, army.location) >= this.maxArmiesPerTypeAtNode(army.location)) return null;

    return this.currentPlayer.splitArmy(army, count);
  }

  mergePlayerArmies(target: Army, source: Army): Army | null {
    if (this.gameOver || this.currentPlayer.defeated) return null;
    if (this.currentBattle) return null;

    return this.currentPlayer.mergeArmies(target, source);
  }

  disbandPlayerArmy(army: Army, count: number): boolean {
    if (this.gameOver || this.currentPlayer.defeated) return false;
    if (this.currentBattle) return false;

    return this.currentPlayer.disbandUnits(army, count);
  }

  get attackableLocations(): Set<string> {
    const locations = new Set<string>();
    for (const enemyLocation of this.enemyLocations) {
      if (this.getArmiesInRange(enemyLocation).length > 0) {
        locations.add(enemyLocation);
      }
    }
    return locations;
  }

  hasAttackTargets(army: Army): boolean {
    for (const enemyLocation of this.enemyLocations) {
      const distance = this.gameMap.getDistance(army.location, enemyLocation);
      if (army.unitStats.range >= distance) return true;
    }
    return false;
  }

  getArmiesInRange(targetLocation: string): Army[] {
    return this.currentPlayer.armies.filter((army) => {
      if (!army.canAttack) return false;
      const distance = this.gameMap.getDistance(army.location, targetLocation);
      return army.unitStats.range >= distance;
    });
  }

  startBattle(targetLocation: string, selectedArmies: Army[]): Battle | null {
    if (this.gameOver || this.currentPlayer.defeated) return null;
    if (this.currentBattle) return null;

    // Find defender player at target location
    const defenderPlayer = this.allPlayers.find(
      (player) => player !== this.currentPlayer
        && player.armies.some((army) => army.location === targetLocation),
    );
    if (!defenderPlayer) return null;

    // Validate all selected armies are in range
    if (selectedArmies.length === 0) return null;
    const allInRange = selectedArmies.every((army) => {
      const distance = this.gameMap.getDistance(army.location, targetLocation);
      return army.unitStats.range >= distance;
    });
    if (!allInRange) return null;

    for (const army of selectedArmies) {
      army.canAttack = false;
    }

    this.currentBattle = new Battle(
      targetLocation,
      this.currentPlayer,
      defenderPlayer,
      selectedArmies,
      this.gameMap,
      this.maxBattleRounds,
    );
    return this.currentBattle;
  }

  resolveBattle(): boolean {
    if (!this.currentBattle) return false;
    if (this.currentBattle.result === BattleResult.Ongoing) return false;

    const battle = this.currentBattle;
    battle.attackerPlayer.removeEmptyArmies();
    battle.defenderPlayer.removeEmptyArmies();
    this.currentBattle = null;

    return true;
  }

  startTurn() {
    // Interest
    this.currentPlayer.money = Math.floor(this.currentPlayer.money * (1 + this.interestRate));

    // Income from owned nodes
    this.currentPlayer.money += this.nodeIncome;

    // Upkeep
    this.currentPlayer.money -= this.currentPlayer.getUpkeep(this.upkeepRate);

    this.currentPlayer.resetAllArmyTurns();
  }

  endTurn(): boolean {
    if (this.gameOver) return false;
    if (this.currentBattle) return false;

    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      if (this.currentPlayerIndex === 0) {
        this.turnCount++;
      }
    } while (this.currentPlayer.defeated && !this.isDraw);

    if (!this.gameOver) this.startTurn();
    return true;
  }

  private checkDefeat() {
    for (const player of this.players) {
      if (player.defeated) continue;

      let ownsAnyRecruitNode = false;
      for (const [node, owner] of this.nodeOwnership) {
        if (owner === player && this.gameMap.getNodeData(node)!.canRecruit) {
          ownsAnyRecruitNode = true;
          break;
        }
      }
      if (!ownsAnyRecruitNode) {
        player.defeated = true;
      }
    }
  }

  toJSON(): GameSave {
    return {
      // Config
      unitStatsMap: structuredClone(this.unitStatsMap),
      gameMap: this.gameMap.toJSON(),
      maxTurns: this.maxTurns,
      maxBattleRounds: this.maxBattleRounds,
      interestRate: this.interestRate,
      upkeepRate: this.upkeepRate,

      // Participants
      players: this.players.map(player => player.toJSON()),
      neutralPlayer: this.neutralPlayer.toJSON(),

      // State
      turnCount: this.turnCount,
      currentPlayerIndex: this.currentPlayerIndex,
      nodeOwnership: Array.from(this.nodeOwnership.entries()).map(
        ([node, owner]) => [node, owner?.name ?? null] as [string, string | null]
      ),
      currentBattle: this.currentBattle?.toJSON() ?? null,
    };
  }

  static fromJSON(save: GameSave): GameSystem {
    const unitStatsMap = structuredClone(save.unitStatsMap);
    const game = Object.create(GameSystem.prototype) as GameSystem;

    // Config
    game.unitStatsMap = unitStatsMap;
    game.gameMap = Graph.fromJSON(save.gameMap);
    game.maxTurns = save.maxTurns;
    game.maxBattleRounds = save.maxBattleRounds;
    game.interestRate = save.interestRate;
    game.upkeepRate = save.upkeepRate;

    // Participants
    game.players = save.players.map(json => {
      const p = Player.fromJSON(json, unitStatsMap);
      p.unitStatsMap = unitStatsMap;
      return p;
    });
    game.neutralPlayer = Player.fromJSON(save.neutralPlayer, unitStatsMap);

    // State
    game.nodeOwnership = new Map();
    for (const [node, ownerName] of save.nodeOwnership) {
      if (ownerName === null) {
        game.nodeOwnership.set(node, null);
      } else {
        const owner = game.allPlayers.find(p => p.name === ownerName) ?? null;
        game.nodeOwnership.set(node, owner);
      }
    }
    game.currentPlayerIndex = save.currentPlayerIndex;
    game.turnCount = save.turnCount;
    game.currentBattle = save.currentBattle
      ? Battle.fromJSON(save.currentBattle, game.allPlayers, game.gameMap, game.maxBattleRounds)
      : null;

    return game;
  }
}

export interface GameSave {
  // Config
  unitStatsMap: UnitStatsMap;
  gameMap: GraphJSON;
  maxTurns: number;
  maxBattleRounds: number;
  interestRate: number;
  upkeepRate: number;

  // Participants
  players: PlayerJSON[];
  neutralPlayer: PlayerJSON;

  // State
  turnCount: number;
  currentPlayerIndex: number;
  nodeOwnership: [string, string | null][];
  currentBattle: BattleSave | null;
}

export default GameSystem;
