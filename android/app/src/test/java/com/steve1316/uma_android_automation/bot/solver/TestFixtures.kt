package com.steve1316.uma_android_automation.bot.solver

import com.steve1316.uma_android_automation.types.Aptitude
import com.steve1316.uma_android_automation.types.RaceGrade
import com.steve1316.uma_android_automation.types.TrackDistance
import com.steve1316.uma_android_automation.types.TrackSurface

/**
 * Shared builders for solver unit tests. Defaults are chosen to make valid races / epithets
 * with minimum boilerplate; tests override only the fields they care about.
 */
internal object TestFixtures {
    fun race(
        name: String,
        turnNumber: TurnNumber,
        grade: RaceGrade = RaceGrade.G1,
        terrain: TrackSurface = TrackSurface.TURF,
        distance: TrackDistance = TrackDistance.MEDIUM,
        raceTrack: String = "Tokyo",
        fans: Int = 10000,
        classYear: String = "Senior",
        distanceMeters: Int = 2000,
        date: String = "$classYear Class January, First Half",
    ): RaceCandidate =
        RaceCandidate(
            key = "$name ($date)",
            name = name,
            nameFormatted = name,
            date = date,
            classYear = classYear,
            raceTrack = raceTrack,
            grade = grade,
            terrain = terrain,
            distanceType = distance,
            distanceMeters = distanceMeters,
            fans = fans,
            turnNumber = turnNumber,
        )

    fun epithet(
        name: String,
        matchers: List<EpithetMatcher>,
        rewardKind: String = "stat",
        amount: Int = 20,
        displayAmount: Int = 10,
        scenarios: List<String> = emptyList(),
    ): Epithet {
        val rewardBullet =
            when (rewardKind) {
                "stat" -> "+$displayAmount to 2 random stats"
                "hint" -> "Skill hint +$amount"
                else -> "+$amount unknown reward"
            }
        val bullets = mutableListOf<String>()
        for (s in scenarios) bullets.add("$s scenario only.")
        bullets.add("(test)")
        bullets.add(rewardBullet)
        return Epithet(name = name, bullets = bullets, matchers = matchers)
    }

    fun win(race: RaceCandidate): RaceWin =
        RaceWin(
            raceKey = race.key,
            name = race.name,
            classYear = race.classYear,
            turnNumber = race.turnNumber,
        )

    fun state(
        currentTurn: TurnNumber = 14,
        races: List<RaceCandidate> = emptyList(),
        epithets: List<Epithet> = emptyList(),
        history: List<RaceWin> = emptyList(),
        completedEpithets: Set<String> = emptySet(),
        deadEpithets: Set<String> = emptySet(),
        forcedEpithets: Set<String> = emptySet(),
        targetEpithets: Set<String> = emptySet(),
        lockedDecisions: Map<TurnNumber, Decision> = emptyMap(),
        aptitudes: Aptitudes = Aptitudes.DEFAULT_A,
        weights: Weights = Weights(),
        scenario: String = "Trackblazer",
    ): SolverState =
        SolverState(
            currentTurn = currentTurn,
            scenario = scenario,
            characterPreset = null,
            aptitudes = aptitudes,
            racesByTurn = races.groupBy { it.turnNumber },
            epithets = epithets,
            raceHistory = history,
            completedEpithets = completedEpithets,
            deadEpithets = deadEpithets,
            forcedEpithets = forcedEpithets,
            targetEpithets = targetEpithets,
            lockedDecisions = lockedDecisions,
            weights = weights,
        )

    /** All-G aptitudes, used to test the eligibility filter. */
    val ALL_G_APTITUDES: Aptitudes =
        Aptitudes(
            Aptitude.G,
            Aptitude.G,
            Aptitude.G,
            Aptitude.G,
            Aptitude.G,
            Aptitude.G,
        )
}
