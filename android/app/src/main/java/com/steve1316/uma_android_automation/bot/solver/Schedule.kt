package com.steve1316.uma_android_automation.bot.solver

/** A turn number in the 72-turn career schedule. The race-eligible window starts at turn 14. */
typealias TurnNumber = Int

/**
 * A decision the solver commits to for a single turn.
 *
 * [Train] and [Rest] are catch-all categories that the existing Racing.kt training logic
 * resolves into specific stat trains or recovery actions. The solver only commits to
 * "race race X" vs. "do something not-racing" at the turn granularity — the rest of the
 * bot retains control over which stat to train, when to recover, etc.
 */
sealed class Decision {
    /**
     * Solver committed to running a specific race this turn.
     * @property raceKey Unique key into races.json — typically `"<name> (<date>)"`.
     */
    data class RaceDecision(val raceKey: String) : Decision()

    /** Solver committed to a non-race "training" turn; concrete stat is chosen by Racing.kt. */
    object Train : Decision() {
        /** @return The literal string `"Train"`, used by log lines and JSON serialisers. */
        override fun toString(): String = "Train"
    }

    /** Solver committed to resting/recovering this turn; energy modelling is left to Racing.kt. */
    object Rest : Decision() {
        /** @return The literal string `"Rest"`. */
        override fun toString(): String = "Rest"
    }
}

/**
 * The solver's output: a per-turn decision plus bookkeeping on which epithets the schedule
 * is projected to complete and the total objective score.
 *
 * @property decisions The decision committed for each turn the solver planned over.
 * @property projectedEpithets Epithet names the schedule is expected to complete.
 * @property totalScore The objective value of this schedule under the active [Weights].
 */
data class Schedule(
    val decisions: Map<TurnNumber, Decision>,
    val projectedEpithets: Set<String>,
    val totalScore: Double,
) {
    /**
     * Returns the decision for [turn], or [Decision.Train] if the solver did not plan it.
     *
     * @param turn Turn number to look up.
     * @return The committed [Decision] for [turn], or [Decision.Train] when [turn] is outside
     *   the planned range.
     */
    fun decisionAt(turn: TurnNumber): Decision = decisions[turn] ?: Decision.Train

    /**
     * Race decisions in turn order, as `(turn, raceKey)` pairs. Train and Rest turns are
     * filtered out, leaving only turns where the solver committed to a specific race.
     *
     * @return List of `(turn, raceKey)` pairs sorted ascending by turn.
     */
    fun raceTurns(): List<Pair<TurnNumber, String>> =
        decisions.entries
            .mapNotNull { (turn, d) -> (d as? Decision.RaceDecision)?.let { turn to it.raceKey } }
            .sortedBy { it.first }
}
