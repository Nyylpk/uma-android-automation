import { levelBoostMultiplier } from "./levelBoostMultiplier"
import { ALL_STAT_NAMES, TrainingConfig, TrainingOption } from "./types"

/**
 * Treat stat targets as desired ratios and score the training based on how well it balances the overall distribution. Ports the Kotlin function with the same name in `Training.kt`.
 *
 * @param config Global scoring inputs.
 * @param training The training option to score.
 * @returns Raw stat-efficiency score (non-negative).
 */
export function calculateStatEfficiencyScore(config: TrainingConfig, training: TrainingOption): number {
    let score = 0

    const activePriority = config.currentDate.isSummer ? config.summerTrainingStatPriority : config.statPrioritization

    for (const statName of ALL_STAT_NAMES) {
        const currentStat = config.currentStats[statName] ?? 0
        const targetStat = config.statTargets[statName] ?? 0
        const statGain = training.statGains[statName] ?? 0

        if (statGain > 0 && targetStat > 0) {
            const priorityIndex = activePriority.indexOf(statName)
            const completionPercent = (currentStat / targetStat) * 100.0

            const ratioMultiplier = (() => {
                const breakpoints = config.scoring.ratioBreakpoints
                const multipliers = config.scoring.ratioMultipliers
                const bucket = breakpoints.findIndex((b) => completionPercent < b)
                return bucket === -1 ? multipliers[multipliers.length - 1] : multipliers[bucket]
            })()

            const priorityMultiplier = priorityIndex !== -1 ? 1.0 + config.scoring.priorityCoefficient * (activePriority.length - priorityIndex) : 1.0

            const levelMultiplier =
                config.enableTrainingLevelWeighting && statName === training.name && priorityIndex !== -1 ? levelBoostMultiplier(priorityIndex + 1, training.trainingLevel, config.scoring) : 1.0

            const isMainStat = training.name === statName
            const threshold = config.scoring.mainStatThresholds[statName]
            if (threshold === undefined) throw new Error(`No mainStatThresholds entry for ${statName}`)
            const mainStatBonus = isMainStat && statGain >= threshold ? config.scoring.mainStatBonusMagnitude : 1.0

            let statScore = statGain
            statScore *= ratioMultiplier
            statScore *= priorityMultiplier
            statScore *= levelMultiplier
            statScore *= mainStatBonus

            score += statScore
        }
    }

    return score
}
