// src/components/TrainingScoringAdvanced/LevelTab.tsx
import React from "react"
import { ScrollView } from "react-native"
import { SCORING_CONSTANTS_CATALOG } from "../../lib/training/scoringConstantsCatalog"
import { MultiplierSlider } from "./MultiplierSlider"
import { TabFooter } from "./TabFooter"

const ENTRIES = SCORING_CONSTANTS_CATALOG.filter((e) => e.group === "level")

/** Props for `LevelTab`. */
export interface LevelTabProps {
    /** Current value per catalog key. */
    values: Record<string, number>
    /** Update the value for one catalog key. */
    onChange: (key: string, value: number) => void
    /** Reset every catalog key in this tab to its default. */
    onResetTab: () => void
}

/**
 * Level tab body: renders one `MultiplierSlider` per Level-group catalog entry plus a `TabFooter`.
 *
 * @param props See `LevelTabProps`.
 * @returns The Level tab content.
 */
export function LevelTab({ values, onChange, onResetTab }: LevelTabProps): React.ReactElement {
    return (
        <ScrollView>
            {ENTRIES.map((entry) => (
                <MultiplierSlider key={entry.key} entry={entry} value={values[entry.key] ?? entry.defaultValue} onChange={(v) => onChange(entry.key, v)} />
            ))}
            <TabFooter entries={ENTRIES} values={values} onResetTab={onResetTab} />
        </ScrollView>
    )
}
