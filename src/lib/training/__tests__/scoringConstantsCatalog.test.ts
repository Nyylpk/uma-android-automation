import { SCORING_CONSTANTS_CATALOG } from "../scoringConstantsCatalog"
import { DEFAULT_TRAINING_SCORING_CONSTANTS, StatName } from "../scoring"

describe("SCORING_CONSTANTS_CATALOG", () => {
    test("no duplicate keys", () => {
        const seen = new Set<string>()
        for (const entry of SCORING_CONSTANTS_CATALOG) {
            expect(seen.has(entry.key)).toBe(false)
            seen.add(entry.key)
        }
    })

    test("priority coefficient default matches", () => {
        const entry = SCORING_CONSTANTS_CATALOG.find((e) => e.key === "priorityCoefficient")!
        expect(entry.defaultValue).toBe(DEFAULT_TRAINING_SCORING_CONSTANTS.priorityCoefficient)
    })

    test("Wit main-stat threshold defaults to 15", () => {
        const entry = SCORING_CONSTANTS_CATALOG.find((e) => e.key === "mainStatThresholdWit")!
        expect(entry.defaultValue).toBe(15)
        expect(entry.defaultValue).toBe(DEFAULT_TRAINING_SCORING_CONSTANTS.mainStatThresholds[StatName.WIT])
    })

    test("six groups present", () => {
        const groups = new Set(SCORING_CONSTANTS_CATALOG.map((e) => e.group))
        for (const g of ["priority", "ratio", "composition", "bonuses", "level", "misc"]) {
            expect(groups.has(g as any)).toBe(true)
        }
    })

    test("every default value falls within [min, max]", () => {
        for (const entry of SCORING_CONSTANTS_CATALOG) {
            expect(entry.defaultValue).toBeGreaterThanOrEqual(entry.min)
            expect(entry.defaultValue).toBeLessThanOrEqual(entry.max)
        }
    })

    test("ratio breakpoint and value entries belong to their monotonic groups", () => {
        const breaks = SCORING_CONSTANTS_CATALOG.filter((e) => e.monotonicGroup === "ratio-breakpoints")
        const vals = SCORING_CONSTANTS_CATALOG.filter((e) => e.monotonicGroup === "ratio-values")
        expect(breaks.length).toBe(6)
        expect(vals.length).toBe(7)
    })
})
