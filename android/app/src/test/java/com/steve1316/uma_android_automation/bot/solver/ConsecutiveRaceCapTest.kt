package com.steve1316.uma_android_automation.bot.solver

import com.steve1316.uma_android_automation.bot.solver.TestFixtures.race
import com.steve1316.uma_android_automation.bot.solver.TestFixtures.state
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("Consecutive-race hard cap")
class ConsecutiveRaceCapTest {
    /** Longest run of back-to-back RaceDecision turns across the 72-turn calendar. */
    private fun longestRaceRun(schedule: Schedule): Int {
        var longest = 0
        var current = 0
        for (t in 1..72) {
            if (schedule.decisions[t] is Decision.RaceDecision) {
                current++
                longest = maxOf(longest, current)
            } else {
                current = 0
            }
        }
        return longest
    }

    /** G1 races on five back-to-back Senior turns (Late Jan -> Late Mar). None are Late-Dec exempt. */
    private fun fiveInARowState(maxConsecutiveRaces: Int?): SolverState =
        state(
            currentTurn = 49,
            races = (50..54).map { race("Senior G1 $it", it) },
        ).copy(maxConsecutiveRaces = maxConsecutiveRaces)

    @Test
    fun milpChainsAllFiveWithoutCap() {
        val schedule = MilpSolver.solve(fiveInARowState(null))
        assertEquals(5, longestRaceRun(schedule), "Without a cap the solver should chain all five eligible G1 races")
    }

    @Test
    fun milpCapsConsecutiveRacesAtThree() {
        val schedule = MilpSolver.solve(fiveInARowState(3))
        assertTrue(longestRaceRun(schedule) <= 3, "MILP must not schedule more than 3 races in a row when capped")
    }

    @Test
    fun beamSearchCapsConsecutiveRacesAtThree() {
        val schedule = Heuristic.search(fiveInARowState(3))
        assertTrue(longestRaceRun(schedule) <= 3, "Beam search must not schedule more than 3 races in a row when capped")
    }

    @Test
    fun facadeCapsConsecutiveRacesAtThree() {
        val schedule = SmartRaceSolver.solve(fiveInARowState(3))
        assertTrue(longestRaceRun(schedule) <= 3, "The solver facade must respect the consecutive-race cap")
    }

    @Test
    fun lateDecemberTurnIsExemptFromTheCap() {
        // Four back-to-back races ending on Classic Late Dec (turn 48). The cap is waived on turn 48, so a chain of
        // four landing there is allowed even with a cap of 3.
        val st =
            state(
                currentTurn = 44,
                races = (45..48).map { race("Classic G1 $it", it) },
            ).copy(maxConsecutiveRaces = 3)
        val schedule = MilpSolver.solve(st)
        assertTrue(
            (45..48).all { schedule.decisions[it] is Decision.RaceDecision },
            "A race chain may run into the Late-December exempt turn (48) even when capped at 3",
        )
    }

    @Test
    fun calendarConstantsUseCorrectOneBasedTurns() {
        assertEquals(setOf(24, 48, 72), ScoringFunctions.LATE_DEC_FREE_TURNS, "Late-Dec exemption must target the last turn of each year")
        assertEquals(
            setOf(37, 38, 39, 40, 61, 62, 63, 64),
            SolverState.DEFAULT_SUMMER_BLOCKS,
            "Summer blocks must be the Classic/Senior Jul-Aug turns; Junior has no summer camp",
        )
    }
}
