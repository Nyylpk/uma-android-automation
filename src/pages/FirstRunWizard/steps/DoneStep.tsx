import { useEffect, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useTheme } from "../../../context/ThemeContext"
import { CtaState } from "./FolderStep"

/** Summary captured when the wizard concludes. */
export interface DoneSummary {
    /** Display name of the picked folder. */
    folderName: string
    /** Migration outcome, undefined if step was skipped entirely. */
    migration?: { movedLogs: number; movedRecordings: number; mode: "move" | "leave" | "delete" }
    /** Granted state of accessibility at end of step 3. */
    accessibility: boolean
    /** Granted state of overlay at end of step 3. */
    overlay: boolean
    /** Granted state of battery at end of step 3. */
    battery: boolean
}

/** Props for `DoneStep`. */
interface Props {
    /** Summary card data. */
    summary: DoneSummary
    /** Called when the user taps the Finish CTA. Must mark first-run completion. */
    onFinish: () => void
    /** Footer CTA registration callback. */
    onCtaChange: (cta: CtaState | null) => void
}

const styles = StyleSheet.create({
    root: { flex: 1, padding: 16 },
    headline: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
    hint: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
    card: { borderWidth: 1, borderRadius: 8, padding: 14 },
    cardLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, marginBottom: 8 },
    summaryRow: { fontSize: 13, lineHeight: 22 },
})

/** Step 4 of the first-run wizard: summary + finish CTA.
 *
 * Pure render. The Finish button calls `onFinish` which the wizard root wires to `markComplete()`.
 *
 * @param props See `Props`.
 * @returns A React node.
 */
const DoneStep = ({ summary, onFinish, onCtaChange }: Props) => {
    const { colors } = useTheme()

    // Latest-ref pattern so the CTA effect doesn't re-fire on parent callback identity changes.
    const onFinishRef = useRef(onFinish)
    const onCtaChangeRef = useRef(onCtaChange)
    useEffect(() => { onFinishRef.current = onFinish })
    useEffect(() => { onCtaChangeRef.current = onCtaChange })

    useEffect(() => {
        onCtaChangeRef.current({ label: "Open the app", enabled: true, onPress: () => onFinishRef.current() })
    }, [])

    const permRow = (label: string, granted: boolean) => (
        <Text style={[styles.summaryRow, { color: granted ? colors.text : colors.warning }]}>
            {label}: {granted ? "Granted" : "Skipped"}
        </Text>
    )

    return (
        <View style={styles.root}>
            <Text style={[styles.headline, { color: colors.text }]}>All set.</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>Your bot is ready to run.</Text>
            <View style={[styles.card, { borderColor: colors.borderHair }]}>
                <Text style={[styles.cardLabel, { color: colors.textMuted }]}>SUMMARY</Text>
                <Text style={[styles.summaryRow, { color: colors.text }]}>Folder: {summary.folderName}</Text>
                {summary.migration && summary.migration.mode === "move" && (
                    <Text style={[styles.summaryRow, { color: colors.text }]}>Moved: {summary.migration.movedLogs} logs, {summary.migration.movedRecordings} recordings</Text>
                )}
                {permRow("Accessibility", summary.accessibility)}
                {permRow("Overlay", summary.overlay)}
                {permRow("Battery", summary.battery)}
            </View>
        </View>
    )
}

export default DoneStep
