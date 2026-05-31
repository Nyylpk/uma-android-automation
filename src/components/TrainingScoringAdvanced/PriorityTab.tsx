// src/components/TrainingScoringAdvanced/PriorityTab.tsx
import React from "react"
import { ScrollView } from "react-native"
import { SCORING_CONSTANTS_CATALOG } from "../../lib/training/scoringConstantsCatalog"
import { MultiplierSlider } from "./MultiplierSlider"
import { TabFooter } from "./TabFooter"

const ENTRIES = SCORING_CONSTANTS_CATALOG.filter((e) => e.group === "priority")

/** Props for `PriorityTab`. */
export interface PriorityTabProps {
    /** Current value per catalog key. */
    values: Record<string, number>
    /** Update the value for one catalog key. */
    onChange: (key: string, value: number) => void
    /** Reset every catalog key in this tab to its default. */
    onResetTab: () => void
}

/**
 * Priority tab body: renders one `MultiplierSlider` per Priority-group catalog entry plus a `TabFooter`.
 *
 * @param props See `PriorityTabProps`.
 * @returns The Priority tab content.
 */
export function PriorityTab({ values, onChange, onResetTab }: PriorityTabProps): React.ReactElement {
    return (
        <ScrollView>
            {ENTRIES.map((entry) => (
                <MultiplierSlider key={entry.key} entry={entry} value={values[entry.key] ?? entry.defaultValue} onChange={(v) => onChange(entry.key, v)} />
            ))}
            <TabFooter entries={ENTRIES} values={values} onResetTab={onResetTab} />
        </ScrollView>
    )
}
