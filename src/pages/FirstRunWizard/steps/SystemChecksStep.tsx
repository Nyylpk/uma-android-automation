import { useCallback, useEffect, useRef, useState } from "react"
import { StyleSheet, View } from "react-native"
import SystemChecksWizard, { SystemCheckResults } from "../../../components/SystemChecksWizard"
import { CtaState } from "./FolderStep"

/** Props for `SystemChecksStep`. */
interface Props {
    /** Called with the final snapshot of permission grants when the user has visited all checks. */
    onSnapshot: (results: SystemCheckResults) => void
    /** Called when the user taps the outer Finish button (only enabled once all checks visited). */
    onAdvance: () => void
    /** Footer CTA registration callback. */
    onCtaChange: (cta: CtaState | null) => void
}

const styles = StyleSheet.create({
    root: { flex: 1, padding: 16 },
})

/** Final step of the first-run wizard: walks the user through accessibility, overlay, battery via the
 * shared `SystemChecksWizard` component rendered with its standalone card chrome (same look as
 * Debug Settings). When the inner wizard reports `onAllVisited`, registers a Finish CTA that closes
 * the wizard.
 *
 * @param props See `Props`.
 * @returns A React node.
 */
const SystemChecksStep = ({ onSnapshot, onAdvance, onCtaChange }: Props) => {
    const [results, setResults] = useState<SystemCheckResults | null>(null)

    // Latest-ref pattern so the effects don't re-run on parent callback identity changes.
    const onSnapshotRef = useRef(onSnapshot)
    const onCtaChangeRef = useRef(onCtaChange)
    const onAdvanceRef = useRef(onAdvance)
    useEffect(() => { onSnapshotRef.current = onSnapshot })
    useEffect(() => { onCtaChangeRef.current = onCtaChange })
    useEffect(() => { onAdvanceRef.current = onAdvance })

    const handleAllVisited = useCallback((r: SystemCheckResults) => {
        setResults(r)
        onSnapshotRef.current(r)
    }, [])

    useEffect(() => {
        onCtaChangeRef.current(results ? { label: "Finish", enabled: true, onPress: () => onAdvanceRef.current() } : null)
    }, [results])

    return (
        <View style={styles.root}>
            <SystemChecksWizard onAllVisited={handleAllVisited} />
        </View>
    )
}

export default SystemChecksStep
