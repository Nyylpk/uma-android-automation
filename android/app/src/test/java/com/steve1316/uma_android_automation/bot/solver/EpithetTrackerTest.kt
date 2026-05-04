package com.steve1316.uma_android_automation.bot.solver

import com.steve1316.uma_android_automation.bot.solver.TestFixtures.epithet
import com.steve1316.uma_android_automation.bot.solver.TestFixtures.race
import com.steve1316.uma_android_automation.bot.solver.TestFixtures.state
import com.steve1316.uma_android_automation.bot.solver.TestFixtures.win
import com.steve1316.uma_android_automation.types.RaceGrade
import com.steve1316.uma_android_automation.types.TrackDistance
import com.steve1316.uma_android_automation.types.TrackSurface
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("EpithetTracker classification")
class EpithetTrackerTest {
    @Test
    fun emptyHistoryAllUntouched() {
        val ep = epithet("Test", listOf(EpithetMatcher.WinRace("Japan Cup")))
        val st = state(epithets = listOf(ep))

        assertEquals(EpithetStatus.UNTOUCHED, EpithetTracker.classify(ep, st))
    }

    @Test
    fun winRaceMatcherCompletesEpithet() {
        val japanCup = race("Japan Cup", turnNumber = 64)
        val ep = epithet("Done", listOf(EpithetMatcher.WinRace("Japan Cup")))
        val st = state(races = listOf(japanCup), epithets = listOf(ep), history = listOf(win(japanCup)))

        assertEquals(EpithetStatus.COMPLETED, EpithetTracker.classify(ep, st))
        assertTrue(EpithetTracker.isCompleted(ep, st))
    }

    @Test
    fun atClassQualifierFiltersByClassYear() {
        val japanCupClassic = race("Japan Cup", turnNumber = 40, classYear = "Classic")
        val japanCupSenior = race("Japan Cup", turnNumber = 64, classYear = "Senior")
        val ep = epithet("Classic Only", listOf(EpithetMatcher.WinRace("Japan Cup", atClass = "Classic")))

        val srSenior = state(races = listOf(japanCupSenior), epithets = listOf(ep), history = listOf(win(japanCupSenior)))
        val srClassic = state(races = listOf(japanCupClassic), epithets = listOf(ep), history = listOf(win(japanCupClassic)))

        assertFalse(EpithetTracker.isCompleted(ep, srSenior), "Senior win must not satisfy Classic-only matcher")
        assertTrue(EpithetTracker.isCompleted(ep, srClassic), "Classic win must satisfy the matcher")
    }

    @Test
    fun winCountFilterCountsDirtG1Wins() {
        val r1 = race("Champions Cup", 50, grade = RaceGrade.G1, terrain = TrackSurface.DIRT, raceTrack = "Chukyo")
        val r2 = race("February Stakes", 52, grade = RaceGrade.G1, terrain = TrackSurface.DIRT, raceTrack = "Tokyo")
        val r3 = race("Japan Cup Dirt", 56, grade = RaceGrade.G1, terrain = TrackSurface.DIRT, raceTrack = "Chukyo")
        val turfRace = race("Tenno Sho (Autumn)", 58, grade = RaceGrade.G1, terrain = TrackSurface.TURF)

        val achiever =
            epithet(
                name = "Dirt G1 Achiever",
                matchers =
                    listOf(
                        EpithetMatcher.WinCount(count = 3, filter = EpithetFilter(terrain = TrackSurface.DIRT, grade = RaceGrade.G1)),
                    ),
            )

        val st =
            state(
                races = listOf(r1, r2, r3, turfRace),
                epithets = listOf(achiever),
                history = listOf(win(r1), win(r2), win(turfRace)),
            )

        // Only 2 dirt G1 wins so far — turf win does not count.
        assertEquals(EpithetStatus.IN_PROGRESS, EpithetTracker.classify(achiever, st))

        val withThird = st.copy(raceHistory = st.raceHistory + win(r3))
        assertEquals(EpithetStatus.COMPLETED, EpithetTracker.classify(achiever, withThird))
    }

    @Test
    fun epithetAllRequiresPrerequisitesInCompletedSet() {
        val incredible =
            epithet(
                name = "Incredible",
                matchers =
                    listOf(
                        EpithetMatcher.EpithetAll(listOf("Stunning")),
                        EpithetMatcher.WinAnyOf(listOf("Japan Cup", "Arima Kinen"), atClass = "Classic"),
                    ),
            )
        val arima = race("Arima Kinen", 48, classYear = "Classic")

        val noStunning =
            state(
                races = listOf(arima),
                epithets = listOf(incredible),
                history = listOf(win(arima)),
                completedEpithets = emptySet(),
            )
        assertFalse(EpithetTracker.isCompleted(incredible, noStunning))

        val withStunning = noStunning.copy(completedEpithets = setOf("Stunning"))
        assertTrue(EpithetTracker.isCompleted(incredible, withStunning))
    }

    @Test
    fun deadEpithetStaysDead() {
        val ep = epithet("Dead", listOf(EpithetMatcher.WinRace("Some Race")))
        val st = state(epithets = listOf(ep), deadEpithets = setOf("Dead"))

        assertEquals(EpithetStatus.DEAD, EpithetTracker.classify(ep, st))
    }

    @Test
    fun winRaceTimesNeedsRepeatedWins() {
        val jbcSprint = race("JBC Sprint", 58, terrain = TrackSurface.DIRT, distance = TrackDistance.SPRINT)
        val ep = epithet("Dirt Sprinter", listOf(EpithetMatcher.WinRaceTimes("JBC Sprint", times = 2)))

        val once = state(races = listOf(jbcSprint), epithets = listOf(ep), history = listOf(win(jbcSprint)))
        assertEquals(EpithetStatus.IN_PROGRESS, EpithetTracker.classify(ep, once))

        val twice = once.copy(raceHistory = once.raceHistory + win(jbcSprint.copy(turnNumber = 60)))
        assertEquals(EpithetStatus.COMPLETED, EpithetTracker.classify(ep, twice))
    }
}
