// src/components/TrainingScoringAdvanced/TabFooter.tsx
import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { ScoringConstantEntry } from "../../lib/training/scoringConstantsCatalog"
import { Button } from "../ui/button"
import { useTheme } from "../../context/ThemeContext"
import { SPACING } from "../../lib/spacing"
import { TYPE } from "../../lib/type"

/** Props for `TabFooter`. */
export interface TabFooterProps {
    /** Catalog entries shown in this tab. */
    entries: readonly ScoringConstantEntry[]
    /** Current values per catalog key. */
    values: Record<string, number>
    /** Press handler for the Reset button. */
    onResetTab: () => void
}

/**
 * Per-tab footer: shows a Reset button and an "N changed" counter where N is the number of entries whose current value differs from the catalog default.
 *
 * @param props See `TabFooterProps`.
 * @returns A footer row at the bottom of an Advanced tab.
 */
export function TabFooter({ entries, values, onResetTab }: TabFooterProps): React.ReactElement {
    const { colors } = useTheme()
    const changed = entries.filter((e) => (values[e.key] ?? e.defaultValue) !== e.defaultValue).length
    return (
        <View style={styles.container}>
            <Text style={[TYPE.body, { color: colors.mutedForeground }]}>{`${changed} changed`}</Text>
            <Button onPress={onResetTab} variant="secondary" size="sm">
                <Text style={[TYPE.body, { color: colors.foreground }]}>Reset tab</Text>
            </Button>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: SPACING.md,
        gap: SPACING.sm,
    },
})
