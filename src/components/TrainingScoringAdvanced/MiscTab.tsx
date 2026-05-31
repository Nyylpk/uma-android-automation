// src/components/TrainingScoringAdvanced/MiscTab.tsx
import React from "react"
import { ScrollView } from "react-native"
import { SCORING_CONSTANTS_CATALOG } from "../../lib/training/scoringConstantsCatalog"
import { MultiplierSlider } from "./MultiplierSlider"
import { TabFooter } from "./TabFooter"

const ENTRIES = SCORING_CONSTANTS_CATALOG.filter((e) => e.group === "misc")

/** Props for `MiscTab`. */
export interface MiscTabProps {
    /** Current value per catalog key. */
    values: Record<string, number>
    /** Update the value for one catalog key. */
    onChange: (key: string, value: number) => void
    /** Reset every catalog key in this tab to its default. */
    onResetTab: () => void
}

/**
 * Misc tab body: renders one `MultiplierSlider` per Misc-group catalog entry plus a `TabFooter`.
 *
 * @param props See `MiscTabProps`.
 * @returns The Misc tab content.
 */
export function MiscTab({ values, onChange, onResetTab }: MiscTabProps): React.ReactElement {
    return (
        <ScrollView>
            {ENTRIES.map((entry) => (
                <MultiplierSlider key={entry.key} entry={entry} value={values[entry.key] ?? entry.defaultValue} onChange={(v) => onChange(entry.key, v)} />
            ))}
            <TabFooter entries={ENTRIES} values={values} onResetTab={onResetTab} />
        </ScrollView>
    )
}
