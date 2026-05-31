// src/components/TrainingScoringAdvanced/RatioTab.tsx
import React from "react"
import { ScrollView } from "react-native"
import { SCORING_CONSTANTS_CATALOG } from "../../lib/training/scoringConstantsCatalog"
import { MultiplierSlider } from "./MultiplierSlider"
import { TabFooter } from "./TabFooter"
import { propagateMonotonic } from "./monotonicGroup"

const ENTRIES = SCORING_CONSTANTS_CATALOG.filter((e) => e.group === "ratio")

/** Props for `RatioTab`. */
export interface RatioTabProps {
    /** Current value per catalog key. */
    values: Record<string, number>
    /** Update the value for one catalog key. */
    onChange: (key: string, value: number) => void
    /** Reset every catalog key in this tab to its default. */
    onResetTab: () => void
}

/**
 * Ratio tab body: renders one `MultiplierSlider` per Ratio-group entry. Entries inside a monotonic group propagate their value to siblings via `propagateMonotonic`.
 *
 * @param props See `RatioTabProps`.
 * @returns The Ratio tab content.
 */
export function RatioTab({ values, onChange, onResetTab }: RatioTabProps): React.ReactElement {
    function handleChange(key: string, value: number) {
        const updates = propagateMonotonic(ENTRIES, key, value, values)
        for (const [k, v] of updates) onChange(k, v)
    }

    return (
        <ScrollView>
            {ENTRIES.map((entry) => (
                <MultiplierSlider key={entry.key} entry={entry} value={values[entry.key] ?? entry.defaultValue} onChange={(v) => handleChange(entry.key, v)} />
            ))}
            <TabFooter entries={ENTRIES} values={values} onResetTab={onResetTab} />
        </ScrollView>
    )
}
