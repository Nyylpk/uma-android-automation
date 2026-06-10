import { useCallback, useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import CustomButton from "../../components/CustomButton"
import { SystemCheckResults } from "../../components/SystemChecksWizard"
import { useTheme } from "../../context/ThemeContext"
import { useLegacyFileScan } from "../../hooks/useLegacyFileScan"
import { PickedFolder, MigrationResult } from "../../lib/storageBridge"
import FolderStep, { CtaState } from "./steps/FolderStep"
import MigrationStep, { MigrationChoice } from "./steps/MigrationStep"
import SystemChecksStep from "./steps/SystemChecksStep"
import DoneStep, { DoneSummary } from "./steps/DoneStep"

/** Props for `FirstRunWizard`. */
interface Props {
    /** Called when the user taps Finish on the Done step. Should mark the SQLite flag and unmount. */
    onComplete: () => Promise<void>
}

type StepKey = "folder" | "migration" | "systemChecks" | "done"

const styles = StyleSheet.create({
    root: { flex: 1 },
    counter: { fontSize: 11, letterSpacing: 0.6, textAlign: "center", marginTop: 16 },
    progressTrack: { height: 3, marginHorizontal: 16, marginTop: 8, marginBottom: 8, borderRadius: 2, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 2 },
    body: { flex: 1 },
    footer: { padding: 16 },
    saveError: { fontSize: 12, marginBottom: 8, textAlign: "center" },
})

/** Top-level first-run wizard. Mounted by `AppWithBootstrap` when `firstRun.completed` is unset.
 *
 * Renders the step counter + progress bar, the active step body, and the fixed footer CTA. Owns
 * outer step state and the cross-step data (picked folder, migration outcome, permission snapshot).
 *
 * @param props See `Props`.
 * @returns A React node.
 */
const FirstRunWizard = ({ onComplete }: Props) => {
    const { colors } = useTheme()
    const { scanning, counts, hasLegacyFiles } = useLegacyFileScan()
    const [outerStep, setOuterStep] = useState(0)
    const [picked, setPicked] = useState<PickedFolder | null>(null)
    const [migrationOutcome, setMigrationOutcome] = useState<{ choice: MigrationChoice; result: MigrationResult | null } | null>(null)
    const [systemResults, setSystemResults] = useState<SystemCheckResults | null>(null)
    const [outerCta, setOuterCta] = useState<CtaState | null>(null)
    const [pendingAdvance, setPendingAdvance] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    const steps = useMemo((): StepKey[] => {
        const list: StepKey[] = ["folder"]
        if (hasLegacyFiles) list.push("migration")
        list.push("systemChecks", "done")
        return list
    }, [hasLegacyFiles])

    const total = steps.length
    const current = steps[Math.min(outerStep, total - 1)]

    const advance = useCallback(() => setOuterStep(prev => Math.min(prev + 1, steps.length - 1)), [steps.length])

    // If the user tapped Continue on step 1 while the scan was in flight, advance once the list settles.
    useEffect(() => {
        if (pendingAdvance && !scanning) {
            setPendingAdvance(false)
            advance()
        }
    }, [pendingAdvance, scanning, advance])

    const handleFolderAdvance = useCallback(() => {
        if (scanning) {
            setPendingAdvance(true)
            return
        }
        advance()
    }, [scanning, advance])

    const handleMigrationChoice = useCallback((choice: MigrationChoice, result: MigrationResult | null) => {
        setMigrationOutcome({ choice, result })
    }, [])

    const handleFinish = useCallback(async () => {
        setSaveError(null)
        try {
            await onComplete()
        } catch {
            setSaveError("Couldn't save your setup. Tap Open the app to retry.")
        }
    }, [onComplete])

    const stepBody = (() => {
        switch (current) {
            case "folder":
                return <FolderStep onPick={setPicked} onAdvance={handleFolderAdvance} onCtaChange={setOuterCta} />
            case "migration":
                if (!counts) return null
                return <MigrationStep legacyCounts={counts} onChoice={handleMigrationChoice} onAdvance={advance} />
            case "systemChecks":
                return <SystemChecksStep onSnapshot={setSystemResults} onAdvance={advance} onCtaChange={setOuterCta} />
            case "done": {
                const summary: DoneSummary = {
                    folderName: picked?.name ?? "",
                    migration: migrationOutcome?.result
                        ? { movedLogs: migrationOutcome.result.movedLogs, movedRecordings: migrationOutcome.result.movedRecordings, mode: migrationOutcome.choice }
                        : migrationOutcome
                            ? { movedLogs: 0, movedRecordings: 0, mode: migrationOutcome.choice }
                            : undefined,
                    accessibility: systemResults?.accessibility ?? false,
                    overlay: systemResults?.overlay ?? false,
                    battery: systemResults?.battery ?? false,
                }
                return <DoneStep summary={summary} onFinish={handleFinish} onCtaChange={setOuterCta} />
            }
        }
    })()

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            <Text style={[styles.counter, { color: colors.textMuted }]}>STEP {outerStep + 1} OF {total}</Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.borderHair }]}>
                <View style={[styles.progressFill, { width: `${((outerStep + 1) / total) * 100}%`, backgroundColor: colors.primary }]} />
            </View>
            <View style={styles.body}>{stepBody}</View>
            {outerCta && (
                <View style={styles.footer}>
                    {saveError && <Text style={[styles.saveError, { color: colors.error }]}>{saveError}</Text>}
                    <CustomButton onPress={outerCta.onPress} disabled={!outerCta.enabled || pendingAdvance}>
                        {pendingAdvance ? "Loading..." : outerCta.label}
                    </CustomButton>
                </View>
            )}
        </View>
    )
}

export default FirstRunWizard
