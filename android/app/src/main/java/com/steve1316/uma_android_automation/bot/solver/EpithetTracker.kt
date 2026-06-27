package com.steve1316.uma_android_automation.bot.solver

import com.steve1316.uma_android_automation.types.RaceGrade

/** Classification of an epithet's reachability given the current solver state. */
enum class EpithetStatus { COMPLETED, IN_PROGRESS, DEAD, UNTOUCHED }

/**
 * Pure functions that interpret epithet matchers against a [SolverState].
 *
 * The tracker is the heart of the recovery logic: when a race is lost, the solver re-classifies
 * epithets, marks the newly-unreachable ones as [EpithetStatus.DEAD], and the heuristic re-plans
 * around them. All functions here are deterministic - same state in, same status out.
 */
object EpithetTracker {
    /**
     * Reduces a [SolverState] to a per-epithet status map keyed by epithet name.
     *
     * @param state Solver state to classify against.
     * @return Map of epithet name to its current [EpithetStatus].
     */
    fun classifyAll(state: SolverState): Map<String, EpithetStatus> =
        state.epithets.associate { it.name to classify(it, state) }

    /**
     * Classifies a single [epithet] against the given [state]. DEAD short-circuits over
     * COMPLETED/IN_PROGRESS so a lost-prerequisite epithet stays DEAD even if other matchers would otherwise be satisfied.
     *
     * @param epithet Epithet to classify.
     * @param state Solver state providing race history and completed/dead sets.
     * @return One of [EpithetStatus.DEAD], [EpithetStatus.COMPLETED], [EpithetStatus.IN_PROGRESS], or [EpithetStatus.UNTOUCHED].
     */
    fun classify(epithet: Epithet, state: SolverState): EpithetStatus {
        if (epithet.name in state.deadEpithets) return EpithetStatus.DEAD
        if (epithet.name in state.completedEpithets || isCompleted(epithet, state)) {
            return EpithetStatus.COMPLETED
        }
        return if (hasAnyProgress(epithet, state)) EpithetStatus.IN_PROGRESS else EpithetStatus.UNTOUCHED
    }

    /**
     * Returns true when every matcher on [epithet] is fully satisfied by [state]'s history.
     * An epithet with no matchers is treated as not-completed since there is nothing to satisfy.
     *
     * @param epithet Epithet whose matchers should be evaluated.
     * @param state Solver state providing the race history.
     * @return True if all matchers are satisfied (and there is at least one), false otherwise.
     */
    fun isCompleted(epithet: Epithet, state: SolverState): Boolean =
        epithet.matchers.isNotEmpty() && epithet.matchers.all { isMatcherSatisfied(it, state) }

    /**
     * Returns true if any of [epithet]'s matchers has at least fractional progress (> 0).
     *
     * @param epithet Epithet to check.
     * @param state Solver state providing the race history and completed-epithet set.
     * @return True if at least one matcher's [progress] is non-zero.
     */
    private fun hasAnyProgress(epithet: Epithet, state: SolverState): Boolean =
        epithet.matchers.any { progress(it, state) > 0.0 }

    /**
     * Counts how many distinct races in the run's history match the given candidate names.
     *
     * @param names The candidate race names to match against.
     * @param state The solver state holding the race-win history.
     * @return The number of distinct matched race names.
     */
    private fun winsMatchingCount(names: List<String>, state: SolverState): Int =
        state.raceHistory.map { it.name }.toSet().intersect(names.toSet()).size

    /**
     * Whole-matcher satisfaction check. Each [EpithetMatcher] subtype has its own predicate;
     * see [Epithet] for the semantics of each.
     *
     * @param matcher The matcher to evaluate.
     * @param state Solver state providing race history and completed-epithet set.
     * @return True if [matcher]'s condition is fully met by the current state.
     */
    fun isMatcherSatisfied(matcher: EpithetMatcher, state: SolverState): Boolean {
        return when (matcher) {
            is EpithetMatcher.WinRace ->
                state.raceHistory.any { win ->
                    win.name == matcher.name &&
                        (matcher.atClass == null || win.classYear.equals(matcher.atClass, ignoreCase = true))
                }
            is EpithetMatcher.WinRaceTimes ->
                state.raceHistory.count { it.name == matcher.name } >= matcher.times
            is EpithetMatcher.WinAnyOf -> {
                val pool = matcher.names.toSet()
                state.raceHistory.count { win ->
                    win.name in pool &&
                        (matcher.atClass == null || win.classYear.equals(matcher.atClass, ignoreCase = true))
                } >= matcher.count
            }
            is EpithetMatcher.WinAtLeast -> winsMatchingCount(matcher.names, state) >= matcher.count
            is EpithetMatcher.WinCount ->
                state.raceHistory.count { matchesFilter(it, matcher.filter, state) } >= matcher.count
            is EpithetMatcher.EpithetAnyOf ->
                matcher.names.any { it in state.completedEpithets }
            is EpithetMatcher.EpithetAll ->
                matcher.names.all { it in state.completedEpithets }
        }
    }

    /**
     * Continuous 0..1 progress for [matcher]. Used by the heuristic to break ties between beams
     * that have not yet completed an epithet. Capped at 1.0 once satisfied so partial overshoot
     * (e.g. 6 wins toward a 5-win matcher) does not skew tiebreaking.
     *
     * @param matcher The matcher to score.
     * @param state Solver state providing race history and completed-epithet set.
     * @return Progress in `[0.0, 1.0]`, where 1.0 means the matcher is fully satisfied.
     */
    fun progress(matcher: EpithetMatcher, state: SolverState): Double {
        return when (matcher) {
            is EpithetMatcher.WinRace -> if (isMatcherSatisfied(matcher, state)) 1.0 else 0.0
            is EpithetMatcher.WinRaceTimes -> {
                val have = state.raceHistory.count { it.name == matcher.name }
                (have.toDouble() / matcher.times).coerceAtMost(1.0)
            }
            is EpithetMatcher.WinAnyOf -> {
                val have =
                    state.raceHistory.count { win ->
                        win.name in matcher.names &&
                            (matcher.atClass == null || win.classYear.equals(matcher.atClass, ignoreCase = true))
                    }
                (have.toDouble() / matcher.count).coerceAtMost(1.0)
            }
            is EpithetMatcher.WinAtLeast -> {
                val have = winsMatchingCount(matcher.names, state)
                (have.toDouble() / matcher.count).coerceAtMost(1.0)
            }
            is EpithetMatcher.WinCount -> {
                val have = state.raceHistory.count { matchesFilter(it, matcher.filter, state) }
                (have.toDouble() / matcher.count).coerceAtMost(1.0)
            }
            is EpithetMatcher.EpithetAnyOf ->
                if (matcher.names.any { it in state.completedEpithets }) 1.0 else 0.0
            is EpithetMatcher.EpithetAll ->
                if (matcher.names.isEmpty()) {
                    1.0
                } else {
                    matcher.names.count { it in state.completedEpithets }.toDouble() / matcher.names.size
                }
        }
    }

    /**
     * Race-against-filter check used by [EpithetMatcher.WinCount]. [RaceWin] only carries the
     * win's identity (key / name / class / turn), so this helper looks up the matching
     * [RaceCandidate] in [SolverState.racesByTurn] to evaluate the structural fields the filter
     * may gate on (terrain, grade, distance type, etc.).
     *
     * @param win The race win whose race attributes should be checked.
     * @param filter The filter predicate from the matcher.
     * @param state Solver state - used to look up the [RaceCandidate] for [win].
     * @return True if [win]'s underlying race satisfies every non-null/non-empty field of [filter].
     *   False if no matching candidate is found or any field rejects it.
     */
    private fun matchesFilter(win: RaceWin, filter: EpithetFilter, state: SolverState): Boolean {
        // RaceWin only carries identity. Filter checks need full RaceCandidate fields, so look up
        // the candidate pool for the win's turn and find the matching key (or fall back to name).
        val candidate =
            state.racesByTurn[win.turnNumber]
                ?.firstOrNull { it.key == win.raceKey || it.name == win.name }
                ?: return false

        if (filter.terrain != null && candidate.terrain != filter.terrain) return false
        if (filter.grade != null && candidate.grade != filter.grade) return false
        if (filter.gradeAtLeastOpen && candidate.grade.ordinal < RaceGrade.OP.ordinal) return false
        if (filter.gradedOnly && candidate.grade !in setOf(RaceGrade.G1, RaceGrade.G2, RaceGrade.G3)) return false
        if (filter.distanceTypes.isNotEmpty() && candidate.distanceType !in filter.distanceTypes) return false
        if (filter.raceTracks.isNotEmpty() && candidate.raceTrack !in filter.raceTracks) return false
        if (filter.nameContains != null && !candidate.name.contains(filter.nameContains, ignoreCase = true)) return false
        if (filter.nameContainsCountry && !EpithetFilters.nameContainsCountry(candidate.name)) return false
        return true
    }
}
