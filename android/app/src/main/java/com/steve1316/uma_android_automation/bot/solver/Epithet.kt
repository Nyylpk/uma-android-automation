package com.steve1316.uma_android_automation.bot.solver

import com.steve1316.uma_android_automation.types.RaceGrade
import com.steve1316.uma_android_automation.types.TrackDistance
import com.steve1316.uma_android_automation.types.TrackSurface

/**
 * Filter predicate used by [EpithetMatcher.WinCount] to decide whether a race counts toward
 * the matcher's tally. Mirrors the structured shape produced by the GameTora epithet scraper.
 *
 * All non-null / non-empty fields combine with logical AND. Empty / null fields are ignored.
 *
 * @property terrain Required surface (Turf or Dirt); null disables the surface check.
 * @property grade Required race grade (e.g. G1, G2); null disables the grade check.
 * @property gradeAtLeastOpen When true, the race must be at least Open class.
 * @property gradedOnly When true, the race must be a graded race (G1/G2/G3).
 * @property distanceTypes Set of allowed distance types; empty disables the distance check.
 * @property raceTracks Set of allowed race-track names; empty disables the track check.
 * @property nameContains Substring that must appear in the race name; null disables the check.
 * @property nameContainsCountry When true, the race name must contain a country token from [EpithetFilters.COUNTRY_NAMES].
 */
data class EpithetFilter(
    val terrain: TrackSurface? = null,
    val grade: RaceGrade? = null,
    val gradeAtLeastOpen: Boolean = false,
    val gradedOnly: Boolean = false,
    val distanceTypes: Set<TrackDistance> = emptySet(),
    val raceTracks: Set<String> = emptySet(),
    val nameContains: String? = null,
    val nameContainsCountry: Boolean = false,
)

/**
 * Structured race-condition predicate the solver evaluates against the win history.
 *
 * The flat list of matchers on an [Epithet] is interpreted as a logical AND: an epithet
 * is completed when every matcher is satisfied. `atClass` is the in-game class year prefix
 * ("Junior", "Classic", or "Senior") for matchers that gate by class (e.g. "Japan Cup (Classic)").
 */
sealed class EpithetMatcher {
    /** Pre-computed canonical condition label produced by `scripts/precompute-epithet-labels.ts`. Null for dependency matchers
     *  ([EpithetAnyOf] / [EpithetAll]) and for legacy snapshots persisted before the field was added. */
    abstract val displayLabel: String?

    /** Pre-computed label template containing a literal `{race}` placeholder substituted at runtime with the contributing race name.
     *  Only [WinAnyOf] / [WinAtLeast] populate this. */
    abstract val displayLabelTemplate: String?

    /**
     * Satisfied when the named race has been won.
     * @property name Exact race name to match.
     * @property atClass Optional class-year prefix ("Junior", "Classic", "Senior") gating the win.
     */
    data class WinRace(
        val name: String,
        val atClass: String? = null,
        override val displayLabel: String? = null,
        override val displayLabelTemplate: String? = null,
    ) : EpithetMatcher()

    /**
     * Satisfied when the named race has been won at least [times] separate times.
     * @property name Exact race name to match.
     * @property times Minimum number of distinct wins required.
     */
    data class WinRaceTimes(
        val name: String,
        val times: Int,
        override val displayLabel: String? = null,
        override val displayLabelTemplate: String? = null,
    ) : EpithetMatcher()

    /**
     * Satisfied when at least [count] of the listed races have been won.
     * @property names Candidate race names; any wins among them count toward the tally.
     * @property count Minimum number of distinct races from [names] that must be won.
     * @property atClass Optional class-year prefix gating eligible wins.
     */
    data class WinAnyOf(
        val names: List<String>,
        val count: Int = 1,
        val atClass: String? = null,
        override val displayLabel: String? = null,
        override val displayLabelTemplate: String? = null,
    ) : EpithetMatcher()

    /**
     * Satisfied when at least [count] distinct races from [names] have been won (no class gating).
     * @property names Candidate race names.
     * @property count Minimum number of distinct races from [names] that must be won.
     */
    data class WinAtLeast(
        val names: List<String>,
        val count: Int,
        override val displayLabel: String? = null,
        override val displayLabelTemplate: String? = null,
    ) : EpithetMatcher()

    /**
     * Satisfied when at least [count] races matching [filter] have been won.
     * @property count Minimum tally of qualifying wins.
     * @property filter Predicate evaluated against each win to decide if it counts.
     */
    data class WinCount(
        val count: Int,
        val filter: EpithetFilter,
        override val displayLabel: String? = null,
        override val displayLabelTemplate: String? = null,
    ) : EpithetMatcher()

    /**
     * Satisfied when at least one of the listed prerequisite epithets has been completed.
     * @property names Names of candidate prerequisite epithets.
     */
    data class EpithetAnyOf(
        val names: List<String>,
        override val displayLabel: String? = null,
        override val displayLabelTemplate: String? = null,
    ) : EpithetMatcher()

    /**
     * Satisfied when every listed prerequisite epithet has been completed.
     * @property names Names of required prerequisite epithets.
     */
    data class EpithetAll(
        val names: List<String>,
        override val displayLabel: String? = null,
        override val displayLabelTemplate: String? = null,
    ) : EpithetMatcher()
}

/**
 * Derivation helpers for the slim epithet schema (`name`, `bullet_points`, `matchers`).
 *
 * GameTora bullets are the single source of truth for human-facing fields the solver doesn't
 * need structured: scenario gating, reward kind, reward magnitude. Each helper here parses
 * one of those derived properties out of the bullet list. The Kotlin and TypeScript layers
 * each implement the same derivation against the same regexes - keep both copies in sync.
 *
 * Keep [COUNTRY_NAMES] in sync with the TS mirror in `src/pages/SmartRaceSolverSettings/index.tsx`.
 */
object EpithetFilters {
    /** Mirrors the reference Trackblazer's `COUNTRY_WORDS` exactly. The trailing space on
     *  `"Japan "` is intentional - without it, every "Japanese ..." race (e.g. "Japanese Derby")
     *  would also match, which is wrong. */
    val COUNTRY_NAMES: List<String> =
        listOf(
            "Saudi Arabia",
            "Argentina",
            "American",
            "New Zealand",
            "Japan ",
        )

    /**
     * Returns true if [name] contains any token from [COUNTRY_NAMES].
     * @param name Race name to test.
     * @return True if the name contains a country token, false otherwise.
     */
    fun nameContainsCountry(name: String): Boolean = COUNTRY_NAMES.any { it in name }

    /** Matches GameTora's scenario-restriction bullet like "Trackblazer scenario only" or
     *  "URA Finale scenario only". Group 1 captures the scenario name verbatim. */
    private val SCENARIO_RESTRICTION_REGEX = Regex("""([A-Za-z][A-Za-z0-9 \-]*?) scenario only""", RegexOption.IGNORE_CASE)

    /** Matches GameTora's character-restriction bullet like "Yaeno Muteki only" or
     *  "Mejiro McQueen only" - the entire bullet is `<character name> only` with no other
     *  text. Group 1 captures the character name verbatim. The pattern intentionally
     *  rejects bullets containing extra words (e.g. "Win 5 races as a Late Surger only")
     *  via the `^...$` anchors. Scenario-restriction bullets are also rejected by the
     *  caller before this regex runs. */
    private val CHARACTER_RESTRICTION_REGEX = Regex("""^(.+?)\s+only$""")

    /** Matches GameTora's stat-reward bullet. Current format: "Reward: 2 random stats +10".
     *  The legacy "+10 to 2 random stats" wording is also recognised so a re-scrape isn't
     *  required to keep older JSON snapshots working. Group 1 = stat count, Group 2 = per-stat amount.
     *  The total reward magnitude is the product. */
    private val STAT_REWARD_REGEX =
        Regex(
            """(?:(\d+)\s+random\s+stats?\s*\+(\d+))|(?:\+(\d+)\s+to\s+(\d+)\s+random\s+stats?)""",
            RegexOption.IGNORE_CASE,
        )

    /** Matches GameTora's hint-reward bullet, e.g. "Reward: Top Pick hint +1" or
     *  "Homestretch Haste hint +1". Group 1 captures the level. */
    private val HINT_REWARD_REGEX = Regex("""hint\s*\+(\d+)""", RegexOption.IGNORE_CASE)

    /**
     * Extracts scenario restrictions from an epithet's bullet list.
     *
     * By convention the restriction is the first bullet (e.g. "Trackblazer scenario only.")
     * but the scan covers every bullet so a future ordering drift doesn't silently break the
     * gate. An empty return means the epithet is universally obtainable.
     *
     * @param bullets The bullet array from the slim epithet schema.
     * @return Scenario names referenced by any "<X> scenario only" bullet.
     */
    private fun scenariosFromBullets(bullets: List<String>): List<String> {
        if (bullets.isEmpty()) return emptyList()
        val out = mutableListOf<String>()
        for (b in bullets) {
            for (m in SCENARIO_RESTRICTION_REGEX.findAll(b)) {
                out.add(m.groupValues[1].trim())
            }
        }
        return out
    }

    /**
     * Returns the scenario gate for [epithet]. Prefers the structured [Epithet.scenarios] field when populated by the scraper,
     * otherwise falls back to parsing [Epithet.bullets] via [scenariosFromBullets].
     *
     * @param epithet The epithet whose scenario gate is being resolved.
     * @return Scenario names that gate availability of the epithet. Empty when the epithet is universally obtainable.
     */
    fun scenariosFor(epithet: Epithet): List<String> =
        if (epithet.scenarios.isNotEmpty()) epithet.scenarios else scenariosFromBullets(epithet.bullets)

    /**
     * Extracts character restrictions from an epithet's bullet list - GameTora prints
     * these as a standalone bullet like "Yaeno Muteki only". Scenario-restriction bullets
     * (which use the word `scenario`) are excluded so they never collide with the
     * character regex. An empty return means the epithet has no character gate.
     *
     * @param bullets The bullet array from the slim epithet schema.
     * @return Character names referenced by any standalone "<name> only" bullet.
     */
    private fun charactersFromBullets(bullets: List<String>): List<String> {
        if (bullets.isEmpty()) return emptyList()
        val out = mutableListOf<String>()
        for (b in bullets) {
            val trimmed = b.trim().trimEnd('.')
            if (trimmed.contains(" scenario only", ignoreCase = true)) continue
            val m = CHARACTER_RESTRICTION_REGEX.matchEntire(trimmed) ?: continue
            out.add(m.groupValues[1].trim())
        }
        return out
    }

    /**
     * Returns the character gate for [epithet]. Prefers the structured [Epithet.characters] field when populated by the scraper,
     * otherwise falls back to parsing [Epithet.bullets] via [charactersFromBullets].
     *
     * @param epithet The epithet whose character gate is being resolved.
     * @return Character names that gate availability of the epithet. Empty when the epithet is available to every character.
     */
    fun charactersFor(epithet: Epithet): List<String> =
        if (epithet.characters.isNotEmpty()) epithet.characters else charactersFromBullets(epithet.bullets)

    /**
     * Parses the reward bullet (last by convention) into a kind + total magnitude pair. Falls
     * back to scanning every bullet so a row whose reward isn't last still works. Mirrors the
     * Python scraper's old `_derive_reward_fields` and the TS `epithetReward` helper.
     *
     * @param bullets The bullet array from the slim epithet schema.
     * @return Pair of (`"stat"` | `"hint"` | `"unknown"`, total magnitude). For stat rewards the magnitude is `per_stat * stat_count`.
     *   For hints it is the level number. Otherwise 0.
     */
    fun rewardFromBullets(bullets: List<String>): Pair<String, Int> {
        if (bullets.isEmpty()) return "unknown" to 0
        val ordered = listOf(bullets.last()) + bullets.dropLast(1)
        for (b in ordered) {
            STAT_REWARD_REGEX.find(b)?.let {
                // Groups 1+2 cover the current "<count> random stats +<perStat>" form. Groups
                // 3+4 cover the legacy "+<perStat> to <count> random stats" form.
                val statCount = (it.groupValues[1].ifEmpty { it.groupValues[4] }).toIntOrNull() ?: 0
                val perStat = (it.groupValues[2].ifEmpty { it.groupValues[3] }).toIntOrNull() ?: 0
                return "stat" to perStat * statCount
            }
            HINT_REWARD_REGEX.find(b)?.let {
                return "hint" to (it.groupValues[1].toIntOrNull() ?: 0)
            }
        }
        return "unknown" to 0
    }
}

/**
 * An in-game epithet (nickname) the player can complete for a stat or skill-hint reward.
 *
 * Sourced from `src/data/epithets.json`, which is generated by the EpithetScraper in
 * `src/data/main.py`. The scraper owns [bullets]; [matchers] are hand-curated locally so
 * re-scrapes never clobber them. Reward kind/amount, scenario restrictions, and prerequisite
 * epithet names are all derived at runtime via [EpithetFilters].
 *
 * @property name Display name of the epithet (also the unique key in epithets.json).
 * @property bullets Free-text bullet list from GameTora's row, in display order: scenario /
 *   character restriction first when present, condition / qualifier bullets in the middle, reward bullet last.
 * @property scenarios Scenario gate (e.g. `["Trackblazer"]`). Empty means universal.
 *   Authored by the Python scraper from `<X> scenario only` bullets; consumers also fall back
 *   to parsing `bullets` directly via [EpithetFilters.scenariosFromBullets] when this field is missing.
 * @property characters Character gate (e.g. `["Yaeno Muteki"]`). Empty means available to
 *   every character. Derived from standalone `<name> only` bullets.
 * @property matchers AND-combined predicates evaluated against the win history.
 */
data class Epithet(
    val name: String,
    val bullets: List<String>,
    val matchers: List<EpithetMatcher>,
    val scenarios: List<String> = emptyList(),
    val characters: List<String> = emptyList(),
)
