package com.steve1316.uma_android_automation.bot.solver

import com.steve1316.uma_android_automation.bot.solver.TestFixtures.epithet
import com.steve1316.uma_android_automation.bot.solver.TestFixtures.race
import com.steve1316.uma_android_automation.bot.solver.TestFixtures.state
import com.steve1316.uma_android_automation.types.Aptitude
import com.steve1316.uma_android_automation.types.RaceGrade
import com.steve1316.uma_android_automation.types.TrackDistance
import com.steve1316.uma_android_automation.types.TrackSurface
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/**
 * Haru Urara is a notoriously weak character (Sprint A, Mile B, Med G, Long G, Turf G, Dirt A),
 * so almost every G1/G2/G3 race is filtered out by the threshold-C aptitude check. The reference
 * Trackblazer site exposes an "include OP" toggle for cases like this — when off, the solver
 * has no eligible races to pick; when on, the OP/Pre-OP Dirt-Sprint races become available and
 * the solver picks some of them.
 *
 * These tests assert both branches.
 */
@DisplayName("Haru Urara — OP / Pre-OP eligibility toggle")
class HaruUraraOpInclusionTest {
    private val haruUraraAptitudes: Aptitudes =
        Aptitudes(
            sprint = Aptitude.A,
            mile = Aptitude.B,
            medium = Aptitude.G,
            long = Aptitude.G,
            turf = Aptitude.G,
            dirt = Aptitude.A,
        )

    /** A small Dirt-Sprint OP race that should be filtered out unless the toggle is enabled. */
    private fun dirtSprintOp(turn: TurnNumber, name: String = "Dirt Sprint OP"): RaceCandidate =
        race(
            name,
            turn,
            grade = RaceGrade.OP,
            terrain = TrackSurface.DIRT,
            distance = TrackDistance.SPRINT,
        )

    /** A Dirt-Sprint G3 — eligible regardless of the toggle. Used as a control. */
    private fun dirtSprintG3(turn: TurnNumber, name: String = "Dirt Sprint G3"): RaceCandidate =
        race(
            name,
            turn,
            grade = RaceGrade.G3,
            terrain = TrackSurface.DIRT,
            distance = TrackDistance.SPRINT,
        )

    @Test
    fun opRacesAreFilteredOutByDefault() {
        val onlyOp = listOf(dirtSprintOp(turn = 50), dirtSprintOp(turn = 55, name = "Other OP"))
        val st =
            state(
                currentTurn = 49,
                races = onlyOp,
                aptitudes = haruUraraAptitudes,
                weights = Weights(includeOpAndPreOp = false),
            )

        // Eligibility is the contract — with the toggle off, both OP races must be filtered out.
        for (race in onlyOp) {
            assertEquals(false, ScoringFunctions.isEligible(race, st), "OP race ${race.name} should be ineligible with the toggle off.")
        }

        val schedule = SmartRaceSolver.solve(st)
        val raceCount = schedule.decisions.values.count { it is Decision.RaceDecision }
        assertEquals(0, raceCount, "Default-off OP toggle should leave the solver with no eligible races; expected an all-Train schedule.")
    }

    @Test
    fun opRacesBecomeEligibleWhenToggleEnabled() {
        // OP races net zero on grade alone with the per-grade cost baseline (gross 29 − OP-cost
        // 29 = 0). To verify the toggle end-to-end we attach a targeted epithet whose only
        // matcher is the OP race; the epithet contribution flips the net positive so MILP picks it.
        val r1 = dirtSprintOp(turn = 50)
        val winR1 =
            epithet(
                "Win Dirt Sprint OP",
                listOf(EpithetMatcher.WinRace("Dirt Sprint OP")),
                amount = 50,
            )
        val st =
            state(
                currentTurn = 49,
                races = listOf(r1),
                epithets = listOf(winR1),
                targetEpithets = setOf("Win Dirt Sprint OP"),
                aptitudes = haruUraraAptitudes,
                weights = Weights(includeOpAndPreOp = true),
            )

        // With the toggle on, the OP race must be eligible.
        assertTrue(ScoringFunctions.isEligible(r1, st), "OP race should be eligible with the toggle on.")

        // And the schedule should actually pick it, since the targeted epithet pushes it
        // above Train's anti-race bias.
        val schedule = SmartRaceSolver.solve(st)
        val raceTurns =
            schedule.decisions
                .filterValues { it is Decision.RaceDecision }
                .keys
        assertTrue(50 in raceTurns, "Toggle on + epithet target should produce a race pick on turn 50; got $raceTurns.")
    }

    @Test
    fun gradedRacesStayEligibleRegardlessOfToggle() {
        val g3 = dirtSprintG3(turn = 50)
        val stOff =
            state(
                currentTurn = 49,
                races = listOf(g3),
                aptitudes = haruUraraAptitudes,
                weights = Weights(includeOpAndPreOp = false),
            )

        // G3 net score = 0 under default raceCostPct=100 + raceBonusPct=50, so the solver may
        // still skip it for Train (score 1.0). What we care about is that the race is listed
        // in the eligible candidate set — verify directly via [ScoringFunctions.isEligible].
        assertTrue(ScoringFunctions.isEligible(g3, stOff), "Graded races must remain eligible even with the OP toggle off.")
    }
}
