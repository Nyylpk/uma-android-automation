import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, AppState, AppStateStatus, NativeModules, Pressable, StyleSheet, Text, View } from "react-native"
import Ionicons from "@react-native-vector-icons/ionicons"
import { useTheme } from "../../context/ThemeContext"
import { TYPE } from "../../lib/type"
import { SPACING } from "../../lib/spacing"
import { RADII } from "../../lib/radii"
import CustomButton from "../CustomButton"

const { StartModule } = NativeModules

/** Snapshot of the three system permission states reported up to consumers when the user has finished walking the wizard. */
export interface SystemCheckResults {
    /** Whether the Accessibility Service is currently granted (system-enabled AND running). */
    accessibility: boolean
    /** Whether the Overlay (Display over other apps) permission is currently granted. */
    overlay: boolean
    /** Whether the app is currently exempt from battery optimization. */
    battery: boolean
}

/** Props for `SystemChecksWizard`. */
interface Props {
    /** Called exactly once when the wizard has been fully exercised. Fires either when the user
     * advances through all 3 sub-steps (the explicit path) or when all 3 permissions are already
     * granted on mount (the implicit path, where the wizard would otherwise show the done card
     * immediately and the user has nothing to walk through). The argument is the final snapshot of
     * grant state at the moment of firing.
     */
    onAllVisited?: (results: SystemCheckResults) => void
    /** Called every time any of the three permission grants changes (including the initial poll on
     * mount and subsequent AppState refreshes). Use this to live-track whether all permissions are
     * currently granted, e.g. to gate a parent wizard's Finish button.
     */
    onPermissionsChange?: (results: SystemCheckResults) => void
    /** When true, the wizard renders with tighter padding and no outer card border so it nests cleanly inside a parent wizard. */
    embeddedInWizard?: boolean
}

/** Shape of the Accessibility Service status returned by the native module. */
interface AccessibilityStatus {
    /** True when the user has enabled the Accessibility Service for this app in system settings. */
    enabled: boolean
    /** True when the service is enabled AND currently running. False if Android killed it in the background. */
    active: boolean
}

/** Shape of the Overlay permission status returned by the native module. */
interface OverlayStatus {
    /** True when the "Display over other apps" permission has been granted. */
    enabled: boolean
}

/** Shape of the battery optimization status returned by the native module. */
interface BatteryStatus {
    /** True when this app is in the system "ignore battery optimization" allowlist. */
    enabled: boolean
}

/**
 * Self-contained system permissions mini-wizard. Hosts the same three sub-steps (Accessibility, Overlay, Battery Optimization) that Debug Settings used to render inline so the first-run wizard and
 * Debug Settings can share the exact same UX.
 *
 * @param onAllVisited Optional callback fired once the user has visited every sub-step at least once. Receives the final granted snapshot at the time the last step was visited.
 * @param embeddedInWizard When true, drops the outer card chrome and tightens padding for nesting inside a parent wizard.
 * @returns The system checks wizard view.
 */
const SystemChecksWizard = ({ onAllVisited, onPermissionsChange, embeddedInWizard = false }: Props) => {
    const { colors } = useTheme()

    const [accessibilityStatus, setAccessibilityStatus] = useState<AccessibilityStatus | null>(null)
    const [overlayStatus, setOverlayStatus] = useState<OverlayStatus | null>(null)
    const [batteryStatus, setBatteryStatus] = useState<BatteryStatus | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isRefreshingOverlay, setIsRefreshingOverlay] = useState(false)
    const [isRefreshingBattery, setIsRefreshingBattery] = useState(false)
    const [currentWizardStep, setCurrentWizardStep] = useState<number>(0)
    const [recheckingIndex, setRecheckingIndex] = useState<number | null>(null)
    const [visited, setVisited] = useState<Set<number>>(() => new Set([0]))
    const recheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const onAllVisitedRef = useRef(onAllVisited)
    const onPermissionsChangeRef = useRef(onPermissionsChange)
    const allVisitedFiredRef = useRef(false)

    useEffect(() => {
        onAllVisitedRef.current = onAllVisited
    }, [onAllVisited])
    useEffect(() => {
        onPermissionsChangeRef.current = onPermissionsChange
    }, [onPermissionsChange])

    // Fire onPermissionsChange whenever any grant flips. Skips the initial polling-pending window
    // where any of the three statuses is still null so parents don't see a spurious all-false.
    useEffect(() => {
        if (accessibilityStatus === null || overlayStatus === null || batteryStatus === null) return
        onPermissionsChangeRef.current?.({
            accessibility: !!(accessibilityStatus.enabled && accessibilityStatus.active),
            overlay: !!overlayStatus.enabled,
            battery: !!batteryStatus.enabled,
        })
    }, [accessibilityStatus, overlayStatus, batteryStatus])

    /** Checks with the native module if the Accessibility Service is currently running. */
    const checkAccessibilityStatus = useCallback(() => {
        setIsRefreshing(true)
        const startTime = Date.now()
        StartModule.getAccessibilityStatus()
            .then((status: AccessibilityStatus) => {
                const remainingTime = Math.max(0, 200 - (Date.now() - startTime))
                setTimeout(() => {
                    setAccessibilityStatus(status)
                    setIsRefreshing(false)
                }, remainingTime)
            })
            .catch(() => {
                const remainingTime = Math.max(0, 200 - (Date.now() - startTime))
                setTimeout(() => {
                    setAccessibilityStatus({ enabled: false, active: false })
                    setIsRefreshing(false)
                }, remainingTime)
            })
    }, [])

    /** Checks with the native module if the Overlay (Display over other apps) permission is granted. */
    const checkOverlayStatus = useCallback(() => {
        setIsRefreshingOverlay(true)
        const startTime = Date.now()
        StartModule.getOverlayStatus()
            .then((status: OverlayStatus) => {
                const remainingTime = Math.max(0, 200 - (Date.now() - startTime))
                setTimeout(() => {
                    setOverlayStatus(status)
                    setIsRefreshingOverlay(false)
                }, remainingTime)
            })
            .catch(() => {
                const remainingTime = Math.max(0, 200 - (Date.now() - startTime))
                setTimeout(() => {
                    setOverlayStatus({ enabled: false })
                    setIsRefreshingOverlay(false)
                }, remainingTime)
            })
    }, [])

    /** Checks with the native module if the app is currently ignoring battery optimizations. */
    const checkBatteryStatus = useCallback(() => {
        setIsRefreshingBattery(true)
        const startTime = Date.now()
        StartModule.getBatteryOptimizationStatus()
            .then((status: BatteryStatus) => {
                const remainingTime = Math.max(0, 200 - (Date.now() - startTime))
                setTimeout(() => {
                    setBatteryStatus(status)
                    setIsRefreshingBattery(false)
                }, remainingTime)
            })
            .catch(() => {
                const remainingTime = Math.max(0, 200 - (Date.now() - startTime))
                setTimeout(() => {
                    setBatteryStatus({ enabled: false })
                    setIsRefreshingBattery(false)
                }, remainingTime)
            })
    }, [])

    useEffect(() => {
        checkAccessibilityStatus()
        checkOverlayStatus()
        checkBatteryStatus()

        // Refresh all permission statuses whenever the app comes back into the foreground.
        const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
            if (nextAppState === "active") {
                checkAccessibilityStatus()
                checkOverlayStatus()
                checkBatteryStatus()
            }
        })

        return () => {
            subscription.remove()
        }
    }, [checkAccessibilityStatus, checkOverlayStatus, checkBatteryStatus])

    // Clear any pending re-check animation timer when the component unmounts so we don't update state on a stale instance.
    useEffect(() => {
        return () => {
            if (recheckTimerRef.current) clearTimeout(recheckTimerRef.current)
        }
    }, [])

    const styles = useMemo(
        () =>
            StyleSheet.create({
                wrapper: { backgroundColor: colors.surface, borderRadius: RADII.lg, borderWidth: 1, borderColor: colors.borderHair, overflow: "hidden" },
                wrapperEmbedded: { backgroundColor: "transparent", borderRadius: 0, borderWidth: 0, overflow: "visible" },
                wizardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
                wizardHeaderEmbedded: { paddingHorizontal: 0, paddingTop: SPACING.sm },
                stepperLabel: { ...TYPE.monoLabel, color: colors.textMuted },
                dotsRow: { flexDirection: "row", gap: 6, alignItems: "center" },
                dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.borderHair },
                dotFuture: { backgroundColor: "transparent" },
                dotCurrent: { backgroundColor: colors.brand, borderColor: colors.brand },
                dotPast: { backgroundColor: colors.brand, borderColor: colors.brand, opacity: 0.5 },
                wizardBody: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.md, gap: SPACING.sm },
                wizardBodyEmbedded: { paddingHorizontal: 0, paddingTop: SPACING.sm, paddingBottom: SPACING.sm },
                wizardTitle: { ...TYPE.h2, color: colors.text },
                wizardDescription: { ...TYPE.caption, color: colors.textMuted, lineHeight: 18 },
                statusChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
                statusChip: {
                    paddingHorizontal: SPACING.sm,
                    paddingVertical: 3,
                    borderRadius: RADII.pill,
                    borderWidth: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                },
                statusChipGranted: { backgroundColor: colors.successSubtle, borderColor: colors.success },
                statusChipMissing: { backgroundColor: "rgba(255, 90, 110, 0.10)", borderColor: colors.error },
                statusChipPending: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderHair },
                statusChipText: { ...TYPE.monoLabel, fontSize: 10 },
                inlineWarning: { ...TYPE.caption, color: colors.warningText, lineHeight: 18 },
                actionRow: { flexDirection: "row", gap: 10, marginTop: SPACING.sm },
                navRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
                navRowEmbedded: { paddingHorizontal: 0, paddingBottom: SPACING.sm },
                doneCard: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: SPACING.sm },
                doneCardEmbedded: { paddingHorizontal: 0, paddingVertical: SPACING.sm },
                doneHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
                doneTitle: { ...TYPE.h2, color: colors.brand },
                doneCheckRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: 2 },
                doneCheckLabel: { ...TYPE.body, color: colors.text, flex: 1 },
                recheckLink: { ...TYPE.caption, color: colors.brand, fontWeight: "600", marginTop: SPACING.sm },
            }),
        [colors]
    )

    // System checks wizard data. Each step describes one permission and the status, refresh, and open-settings handlers tied to it.
    const wizardSteps = useMemo(
        () => [
            {
                title: "Accessibility Service",
                description: "The Accessibility Service allows the bot to perform clicks and gestures on your behalf.",
                flags: [
                    { label: "System Enabled", granted: accessibilityStatus?.enabled, ready: accessibilityStatus !== null },
                    { label: "Internal State", granted: accessibilityStatus?.active, ready: accessibilityStatus !== null },
                ],
                granted: !!(accessibilityStatus?.enabled && accessibilityStatus?.active),
                refresh: checkAccessibilityStatus,
                refreshing: isRefreshing,
                openSettings: () => StartModule.openAccessibilitySettings(),
                inlineWarning:
                    accessibilityStatus?.enabled && !accessibilityStatus?.active
                        ? "The service is enabled but it seems Android killed it in the background. Toggling it off and back on in settings will restart it."
                        : null,
            },
            {
                title: "Overlay Permission",
                description: "The Overlay (Display over other apps) permission allows the bot to render its on-screen control overlay.",
                flags: [{ label: "Display over other apps", granted: overlayStatus?.enabled, ready: overlayStatus !== null }],
                granted: !!overlayStatus?.enabled,
                refresh: checkOverlayStatus,
                refreshing: isRefreshingOverlay,
                openSettings: () => StartModule.openOverlaySettings(),
                inlineWarning: null,
            },
            {
                title: "Battery Optimization",
                description: "Disabling battery optimization for this app prevents Android from killing the bot during long-running automation runs.",
                flags: [{ label: "Ignoring battery optimization", granted: batteryStatus?.enabled, ready: batteryStatus !== null }],
                granted: !!batteryStatus?.enabled,
                refresh: checkBatteryStatus,
                refreshing: isRefreshingBattery,
                openSettings: () => StartModule.openBatteryOptimizationSettings(),
                inlineWarning: null,
            },
        ],
        [
            accessibilityStatus,
            overlayStatus,
            batteryStatus,
            isRefreshing,
            isRefreshingOverlay,
            isRefreshingBattery,
            checkAccessibilityStatus,
            checkOverlayStatus,
            checkBatteryStatus,
        ]
    )

    const allChecksPassed = wizardSteps.every((s) => s.granted)
    const activeStep = wizardSteps[currentWizardStep]

    /**
     * Marks a sub-step index as visited and fires `onAllVisited` once every sub-step has been seen.
     * @param newIndex The sub-step index the user is now viewing.
     */
    const advanceVisited = useCallback(
        (newIndex: number) => {
            setVisited((prev) => {
                if (prev.has(newIndex)) return prev
                const next = new Set(prev)
                next.add(newIndex)
                if (next.size === wizardSteps.length && !allVisitedFiredRef.current) {
                    allVisitedFiredRef.current = true
                    onAllVisitedRef.current?.({
                        accessibility: !!(accessibilityStatus?.enabled && accessibilityStatus?.active),
                        overlay: !!overlayStatus?.enabled,
                        battery: !!batteryStatus?.enabled,
                    })
                }
                return next
            })
        },
        [wizardSteps.length, accessibilityStatus, overlayStatus, batteryStatus]
    )

    // If the user has every permission granted without manually walking through each sub-step (e.g. they granted them all earlier), still treat that as "all visited" so consumers can advance.
    useEffect(() => {
        if (!allVisitedFiredRef.current && allChecksPassed) {
            allVisitedFiredRef.current = true
            setVisited(new Set(wizardSteps.map((_, i) => i)))
            onAllVisitedRef.current?.({
                accessibility: !!(accessibilityStatus?.enabled && accessibilityStatus?.active),
                overlay: !!overlayStatus?.enabled,
                battery: !!batteryStatus?.enabled,
            })
        }
    }, [allChecksPassed, accessibilityStatus, overlayStatus, batteryStatus, wizardSteps])

    /**
     * Sequentially re-run each system check with a small visual delay so the user sees the progress sweep through the rows.
     * If any check flips to failing, the parent conditional swaps the doneCard for the wizard view automatically.
     */
    const handleRecheckAll = useCallback(() => {
        if (recheckTimerRef.current) clearTimeout(recheckTimerRef.current)
        setCurrentWizardStep(0)
        const steps = wizardSteps
        if (steps.length === 0) return
        setRecheckingIndex(0)
        steps[0].refresh()
        let i = 1
        const advance = () => {
            if (i < steps.length) {
                setRecheckingIndex(i)
                steps[i].refresh()
                i++
                recheckTimerRef.current = setTimeout(advance, 350)
            } else {
                recheckTimerRef.current = setTimeout(() => {
                    setRecheckingIndex(null)
                    recheckTimerRef.current = null
                }, 350)
            }
        }
        recheckTimerRef.current = setTimeout(advance, 350)
    }, [wizardSteps])

    /**
     * Move to the next sub-step and record the visit.
     */
    const goNext = useCallback(() => {
        setCurrentWizardStep((s) => {
            const next = Math.min(wizardSteps.length - 1, s + 1)
            if (next !== s) advanceVisited(next)
            return next
        })
    }, [wizardSteps.length, advanceVisited])

    /**
     * Move to the previous sub-step. Going back still records the visit (the user has seen the step regardless of direction).
     */
    const goBack = useCallback(() => {
        setCurrentWizardStep((s) => {
            const next = Math.max(0, s - 1)
            if (next !== s) advanceVisited(next)
            return next
        })
    }, [advanceVisited])

    const wrapperStyle = embeddedInWizard ? styles.wrapperEmbedded : styles.wrapper
    const headerStyle = embeddedInWizard ? [styles.wizardHeader, styles.wizardHeaderEmbedded] : styles.wizardHeader
    const bodyStyle = embeddedInWizard ? [styles.wizardBody, styles.wizardBodyEmbedded] : styles.wizardBody
    const navStyle = embeddedInWizard ? [styles.navRow, styles.navRowEmbedded] : styles.navRow
    const doneStyle = embeddedInWizard ? [styles.doneCard, styles.doneCardEmbedded] : styles.doneCard

    return (
        <View style={wrapperStyle}>
            {allChecksPassed ? (
                <View style={doneStyle}>
                    <View style={styles.doneHeader}>
                        {recheckingIndex !== null ? (
                            <ActivityIndicator size="small" color={colors.brand} style={{ width: 20, height: 20 }} />
                        ) : (
                            <Ionicons name="checkmark-circle" size={20} color={colors.brand} />
                        )}
                        <Text style={styles.doneTitle}>{recheckingIndex !== null ? "Re-checking system checks..." : "All system checks passed"}</Text>
                    </View>
                    {wizardSteps.map((step, idx) => (
                        <View key={step.title} style={styles.doneCheckRow}>
                            {recheckingIndex === idx ? (
                                <ActivityIndicator size="small" color={colors.brand} style={{ width: 16, height: 16 }} />
                            ) : (
                                <Ionicons name="checkmark" size={16} color={colors.brand} />
                            )}
                            <Text style={styles.doneCheckLabel}>{step.title}</Text>
                        </View>
                    ))}
                    <Pressable
                        onPress={handleRecheckAll}
                        disabled={recheckingIndex !== null}
                        android_ripple={{ color: colors.ripple, foreground: false }}
                        hitSlop={8}
                        style={{ alignSelf: "flex-start", opacity: recheckingIndex !== null ? 0.5 : 1 }}
                    >
                        <Text style={styles.recheckLink}>{recheckingIndex !== null ? "Re-checking..." : "Re-check"}</Text>
                    </Pressable>
                </View>
            ) : (
                <>
                    <View style={headerStyle}>
                        <Text style={styles.stepperLabel}>
                            STEP {currentWizardStep + 1} OF {wizardSteps.length}
                        </Text>
                        <View style={styles.dotsRow}>
                            {wizardSteps.map((_, idx) => (
                                <View key={idx} style={[styles.dot, idx === currentWizardStep ? styles.dotCurrent : idx < currentWizardStep ? styles.dotPast : styles.dotFuture]} />
                            ))}
                        </View>
                    </View>
                    <View style={bodyStyle}>
                        <Text style={styles.wizardTitle}>{activeStep.title}</Text>
                        <View style={styles.statusChipsRow}>
                            {activeStep.flags.map((flag) => {
                                const chipStyle = !flag.ready ? styles.statusChipPending : flag.granted ? styles.statusChipGranted : styles.statusChipMissing
                                const chipColor = !flag.ready ? colors.textMuted : flag.granted ? colors.success : colors.error
                                const chipText = !flag.ready ? "Checking..." : flag.granted ? "✅ Granted" : "❌ Missing"
                                return (
                                    <View key={flag.label} style={[styles.statusChip, chipStyle]}>
                                        <Text style={[styles.statusChipText, { color: chipColor }]}>{flag.label}</Text>
                                        <Text style={[styles.statusChipText, { color: chipColor }]}>·</Text>
                                        <Text style={[styles.statusChipText, { color: chipColor }]}>{chipText}</Text>
                                    </View>
                                )
                            })}
                        </View>
                        <Text style={styles.wizardDescription}>{activeStep.description}</Text>
                        {activeStep.inlineWarning != null && <Text style={styles.inlineWarning}>{activeStep.inlineWarning}</Text>}
                        <View style={styles.actionRow}>
                            <CustomButton variant="outline" onPress={activeStep.refresh} isLoading={activeStep.refreshing} disabled={activeStep.refreshing}>
                                Refresh
                            </CustomButton>
                            <CustomButton variant="primary" onPress={activeStep.openSettings}>
                                Open Settings
                            </CustomButton>
                        </View>
                    </View>
                    <View style={navStyle}>
                        <CustomButton variant="ghost" disabled={currentWizardStep === 0} onPress={goBack}>
                            ← Back
                        </CustomButton>
                        <CustomButton variant="ghost" disabled={currentWizardStep === wizardSteps.length - 1} onPress={goNext}>
                            Next →
                        </CustomButton>
                    </View>
                </>
            )}
        </View>
    )
}

export default SystemChecksWizard
