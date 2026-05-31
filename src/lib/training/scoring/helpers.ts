// src/lib/training/scoring/helpers.ts
import { StatName, TrainingConfig } from "./types"

/** Stats gained per finale race win, per stat. Slightly above the actual +10 to account for misc event/card gains. */
const FINALE_RACE_STAT_BONUS = 15

/**
 * Retrieve the scenario-specific cap for a given stat. Ports `getScenarioStatCap` in `Training.kt`.
 *
 * @param scenario The current training scenario name (currently unused but kept for parity with the Kotlin signature).
 * @param statName The stat to look up (currently unused but kept for parity with the Kotlin signature).
 * @returns The maximum value the specified stat can reach in the given scenario.
 */
function getScenarioStatCap(_scenario: string, _statName: StatName): number {
    return 1200
}

/**
 * Retrieve the current stat cap based on the provided configuration. Ports `getCurrentStatCap` in `Training.kt`.
 *
 * @param statName The stat to query.
 * @param config The current `TrainingConfig` providing the scenario.
 * @returns The current maximum value for the specified stat.
 */
export function getCurrentStatCap(statName: StatName, config: TrainingConfig): number {
    return getScenarioStatCap(config.scenario, statName)
}

/**
 * Calculate the number of remaining finale races based on the current turn. Finale races occur on turns 73, 74, and 75.
 * Before the finale (turn <= 72), all 3 races remain. Ports `getRemainingFinaleRaces` in `Training.kt`.
 *
 * @param currentDay The current turn number (1-75).
 * @returns The number of remaining finale races (0-3).
 */
function getRemainingFinaleRaces(currentDay: number): number {
    return Math.max(0, 75 - Math.max(currentDay, 72))
}

/**
 * Calculate the expected total stat bonus from remaining finale race wins. Ports `getFinaleStatBonus` in `Training.kt`.
 *
 * @param currentDay The current turn number (1-75).
 * @returns The expected stat gain per stat from remaining finale races.
 */
export function getFinaleStatBonus(currentDay: number): number {
    return getRemainingFinaleRaces(currentDay) * FINALE_RACE_STAT_BONUS
}
