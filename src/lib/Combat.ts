import type Unit from "./Unit";
import Army from "./Army";

export function armyAttackArmy(
  attackerArmy: Army, targetArmy: Army, unitCount: number
): void {
  const count = Math.min(unitCount, attackerArmy.units.length);
  for (let i = 0; i < count; i++) {
    if (targetArmy.units.length === 0) break;
    const attackerUnit = attackerArmy.units[i];
    const defenderUnit = findWeakestUnit(targetArmy);
    unitAttack(attackerUnit, defenderUnit);
    targetArmy.removeDeadUnits();
  }
}

export function calculateUnitsNeeded(
  attackerArmy: Army, targetArmy: Army
): number {
  const damage = Math.max(1, attackerArmy.unitStats.attack - targetArmy.unitStats.defend);
  let total = 0;
  for (const unit of targetArmy.units) {
    total += Math.ceil(unit.currentHealth / damage);
  }
  return total;
}

export function findWeakestUnit(army: Army): Unit {
  return army.units.reduce((weakest, unit) => {
    const currentHealthRatio = unit.currentHealth / unit.health;
    const weakestHealthRatio = weakest.currentHealth / weakest.health;
    return currentHealthRatio < weakestHealthRatio ? unit : weakest;
  }, army.units[0]);
}

function unitAttack(attackerUnit: Unit, defenderUnit: Unit): void {
  defenderUnit.currentHealth -= Math.max(1, attackerUnit.attack - defenderUnit.defend);
}
