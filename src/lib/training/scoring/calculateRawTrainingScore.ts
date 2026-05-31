// src/lib/training/scoring/calculateRawTrainingScore.ts
import { calculateMiscScore } from "./calculateMiscScore"
import { calculateRelationshipScore } from "./calculateRelationshipScore"
import { calculateStatEfficiencyScore } from "./calculateStatEfficiencyScore"
import { getCurrentStatCap, getFinaleStatBonus } from "./helpers"
import { DateYear, TrainingConfig, TrainingOption, yearGreaterThan } from "./types"

/**
 * Calculate the raw, un-normalized training score by combining stat efficiency, relationship, and misc scores with weights, the rainbow multiplier, and the anticipatory
 * near-max friendship multiplier. Ports `calculateRawTrainingScore` in `Training.kt`. The raw value will later be normalized against the max raw score across the turn's
 * training options.
 *
 * @param config Global scoring inputs.
 * @param training The training option to score.
 * @returns Raw non-negative training score.
 */
export function calculateRawTrainingScore(config: TrainingConfig, training: TrainingOption): number {
    if (config.blacklist.includes(training.name)) {
        return 0
    }

    const currentStat = config.currentStats[training.name] ?? 0
    const potentialStat = currentStat + (training.statGains[training.name] ?? 0)
    const statCap = getCurrentStatCap(training.name, config)
    const finaleBonus = getFinaleStatBonus(config.currentDate.day)
    const effectiveStatCap = statCap - 100 - finaleBonus

    // Don't score for stats that are close to the absolute cap.
    if (currentStat >= statCap) {
        return 0
    }

    // Don't score for stats that are already above the buffer, unless this is a rainbow training and this stat still has its one-time allowance.
    if (config.disableTrainingOnMaxedStat && currentStat >= effectiveStatCap) {
        const canUseAllowance = training.numRainbow > 0 && !config.statsTrainedOverBuffer.has(training.name)
        if (!canUseAllowance) {
            return 0
        }
    }

    if (potentialStat >= effectiveStatCap) {
        const canUseAllowance = training.numRainbow > 0 && !config.statsTrainedOverBuffer.has(training.name)
        if (!canUseAllowance) {
            return 0
        }
    }

    let totalScore = 0

    // 1. Stat efficiency scoring.
    const statScore = calculateStatEfficiencyScore(config, training)

    // 2. Relationship scoring.
    const relationshipScore = calculateRelationshipScore(config, training)

    // 3. Misc-aware scoring.
    const miscScore = calculateMiscScore(config, training)

    // Define scoring weights based on relationship bars presence.
    const hasBars = training.relationshipBars.length > 0
    const statWeight = hasBars ? config.scoring.statWeightWithBars : config.scoring.statWeightWithoutBars
    const relationshipWeight = hasBars ? config.scoring.relationshipWeightWithBars : 0
    const miscWeight = config.scoring.miscWeight

    // Calculate weighted total score.
    totalScore += statScore * statWeight
    totalScore += relationshipScore * relationshipWeight
    totalScore += miscScore * miscWeight

    // 4. Rainbow training multiplier (Year 2+ only). Rainbow is heavily favored because it improves overall ratio balance.
    const rainbowMultiplier =
        training.numRainbow > 0 && yearGreaterThan(config.currentDate.year, DateYear.JUNIOR)
            ? config.enableRainbowTrainingBonus
                ? config.scoring.rainbowMultiplierEnabled
                : config.scoring.rainbowMultiplierDisabled
            : 1.0

    totalScore *= rainbowMultiplier

    // 5. Anticipatory rainbow multiplier (Year 2+ only, when no real rainbows are present).
    // Each near-max (green/blue) friendship bar contributes fillPercent/100 to a sum, scaled by `anticipatoryCoefficient`, then added to a 1.0 base and capped at
    // `anticipatoryCap` so anticipation never outranks an actual rainbow.
    if (
        config.enablePrioritizeNearMaxFriendship &&
        yearGreaterThan(config.currentDate.year, DateYear.JUNIOR) &&
        training.numRainbow === 0 &&
        training.relationshipBars.length > 0
    ) {
        let contributions = 0
        let qualifyingBars = 0
        for (const bar of training.relationshipBars) {
            if ((bar.dominantColor === "green" || bar.dominantColor === "blue") && bar.fillPercent > config.scoring.anticipatoryMinFillPercent) {
                contributions += bar.fillPercent / 100.0
                qualifyingBars += 1
            }
        }
        if (qualifyingBars > 0) {
            const anticipatoryMultiplier = 1.0 + Math.min(config.scoring.anticipatoryCap, config.scoring.anticipatoryCoefficient * contributions)
            totalScore *= anticipatoryMultiplier
        }
    }

    return Math.max(0, totalScore)
}
