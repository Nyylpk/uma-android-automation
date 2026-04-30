package com.steve1316.uma_android_automation.bot.solver

import com.steve1316.uma_android_automation.bot.solver.TestFixtures.epithet
import com.steve1316.uma_android_automation.bot.solver.TestFixtures.race
import com.steve1316.uma_android_automation.bot.solver.TestFixtures.state
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/**
 * The "Globe-Trotter" epithet uses `winCount` with `nameContainsCountry: true`. Before the fix,
 * `MilpSolver.matchesFilter` ignored that field and counted any race toward the matcher, so the
 * solver projected Globe-Trotter as completed on schedules that shouldn't have qualified.
 *
 * These tests pin the filter behavior via the public MILP entry point.
 */
@DisplayName("Globe-Trotter — `nameContainsCountry` filter is enforced")
class GlobeTrotterFilterTest {
    private fun globeTrotter(count: Int = 3): Epithet =
        epithet(
            name = "Globe-Trotter",
            matchers =
                listOf(
                    EpithetMatcher.WinCount(
                        count = count,
                        filter = EpithetFilter(nameContainsCountry = true),
                    ),
                ),
            amount = 100,
        )

    @Test
    fun nonCountryRacesDoNotProgressGlobeTrotter() {
        val races =
            listOf(
                race("Artemis Stakes", turnNumber = 50),
                race("Sprinters Stakes", turnNumber = 55),
                race("Arima Kinen", turnNumber = 60),
            )
        val st =
            state(
                currentTurn = 49,
                races = races,
                epithets = listOf(globeTrotter()),
                targetEpithets = setOf("Globe-Trotter"),
            )

        val schedule = SmartRaceSolver.solve(st)
        assertTrue(
            "Globe-Trotter" !in schedule.projectedEpithets,
            "None of the eligible race names contain a country word; Globe-Trotter must NOT be projected complete. Got: ${schedule.projectedEpithets}",
        )
    }

    @Test
    fun countryRacesProgressGlobeTrotter() {
        val races =
            listOf(
                race("Japan Cup", turnNumber = 50),
                race("American JCC", turnNumber = 55),
                race("Saudi Arabia Royal Cup", turnNumber = 60),
            )
        val st =
            state(
                currentTurn = 49,
                races = races,
                epithets = listOf(globeTrotter()),
                targetEpithets = setOf("Globe-Trotter"),
            )

        val schedule = SmartRaceSolver.solve(st)
        assertTrue(
            "Globe-Trotter" in schedule.projectedEpithets,
            "Three country-named races should let Globe-Trotter complete. Got: ${schedule.projectedEpithets}",
        )
    }

    @Test
    fun countryHelperMatchesExpectedSubstrings() {
        assertTrue(EpithetFilters.nameContainsCountry("Japan Cup"))
        assertTrue(EpithetFilters.nameContainsCountry("American JCC"))
        assertTrue(EpithetFilters.nameContainsCountry("Saudi Arabia Royal Cup"))
        assertTrue(EpithetFilters.nameContainsCountry("New Zealand Trophy"))
        assertEquals(false, EpithetFilters.nameContainsCountry("Artemis Stakes"))
        assertEquals(false, EpithetFilters.nameContainsCountry("Sprinters Stakes"))
        // Trailing space on "Japan " prevents matching "Japanese …" races.
        assertEquals(false, EpithetFilters.nameContainsCountry("Japanese Derby"))
    }
}
