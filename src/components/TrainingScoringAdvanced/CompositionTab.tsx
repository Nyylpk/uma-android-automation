// src/components/TrainingScoringAdvanced/CompositionTab.tsx
import React from "react"
import { ScrollView, Text, View, StyleSheet } from "react-native"
import { SCORING_CONSTANTS_CATALOG } from "../../lib/training/scoringConstantsCatalog"
import { MultiplierSlider } from "./MultiplierSlider"
import { TabFooter } from "./TabFooter"
import { Button } from "../ui/button"
import { useTheme } from "../../context/ThemeContext"
import { SPACING } from "../../lib/spacing"
import { TYPE } from "../../lib/type"

const ENTRIES = SCORING_CONSTANTS_CATALOG.filter((e) => e.group === "composition")

/** Props for `CompositionTab`. */
export interface CompositionTabProps {
    /** Current value per catalog key. */
    values: Record<string, number>
    /** Update the value for one catalog key. */
    onChange: (key: string, value: number) => void
    /** Reset every catalog key in this tab to its default. */
    onResetTab: () => void
}

/**
 * Composition tab body: renders one `MultiplierSlider` per Composition-group entry, a Normalize button that rescales the three weights to sum to 1, plus a `TabFooter`.
 *
 * @param props See `CompositionTabProps`.
 * @returns The Composition tab content.
 */
export function CompositionTab({ values, onChange, onResetTab }: CompositionTabProps): React.ReactElement {
    const { colors } = useTheme()

    function handleNormalize() {
        const keys = ENTRIES.map((e) => e.key)
        const vs = ENTRIES.map((e) => values[e.key] ?? e.defaultValue)
        const sum = vs.reduce((a, b) => a + b, 0)
        if (sum <= 0) return
        keys.forEach((k, i) => onChange(k, vs[i] / sum))
    }

    return (
        <ScrollView>
            {ENTRIES.map((entry) => (
                <MultiplierSlider key={entry.key} entry={entry} value={values[entry.key] ?? entry.defaultValue} onChange={(v) => onChange(entry.key, v)} />
            ))}
            <View style={styles.normalizeRow}>
                <Button onPress={handleNormalize} variant="outline" size="sm">
                    <Text style={[TYPE.body, { color: colors.foreground }]}>Normalize</Text>
                </Button>
            </View>
            <TabFooter entries={ENTRIES} values={values} onResetTab={onResetTab} />
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    normalizeRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: SPACING.sm,
    },
})
