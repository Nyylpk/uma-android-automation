import React, { useMemo } from "react"
import { View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native"
import { useTheme } from "../../context/ThemeContext"
import { TYPE } from "../../lib/type"
import { SPACING } from "../../lib/spacing"
import { RADII } from "../../lib/radii"

/** A labeled threshold marker on the gauge. */
export interface GaugeMarker {
    /** Label shown beneath the marker (e.g. "1.5B"). */
    label: string
    /** Position from 0..1 along the gauge length. */
    position: number
}

/** Props for `RamGauge`. */
export interface RamGaugeProps {
    /** Headline label rendered above the bar. */
    label: string
    /** Pill verdict (e.g. "4.7 GB Fits"). */
    verdict: string
    /** Fill ratio from 0..1. */
    fillRatio: number
    /** Labeled threshold markers. */
    markers: GaugeMarker[]
    /** Optional container style. */
    style?: StyleProp<ViewStyle>
}

/**
 * Visual headroom gauge used to communicate device fitness against model sizes.
 * @param label Title shown above the gauge.
 * @param verdict Pill text rendered to the right of the label.
 * @param fillRatio Filled portion of the bar from 0..1.
 * @param markers Threshold markers with labels beneath the bar.
 * @param style Optional container style.
 * @returns A card containing a label row, a horizontal bar with markers, and a legend row.
 */
const RamGauge: React.FC<RamGaugeProps> = ({ label, verdict, fillRatio, markers, style }) => {
    const { colors } = useTheme()
    const clamped = Math.max(0, Math.min(1, fillRatio))
    const styles = useMemo(
        () =>
            StyleSheet.create({
                container: { padding: SPACING.md, backgroundColor: colors.surface, borderRadius: RADII.lg, borderWidth: 1, borderColor: colors.border, gap: SPACING.sm },
                head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
                label: { ...TYPE.body, color: colors.text, fontWeight: "600" },
                verdict: { ...TYPE.monoLabel, color: colors.success, paddingHorizontal: SPACING.sm, paddingVertical: 2, backgroundColor: colors.successSubtle, borderRadius: RADII.pill },
                bar: { height: 6, backgroundColor: colors.surfaceRaised, borderRadius: RADII.pill, position: "relative" },
                fill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: colors.brand, borderRadius: RADII.pill },
                marker: { position: "absolute", top: -2, bottom: -2, width: 2, backgroundColor: colors.textMuted, opacity: 0.5 },
                legend: { position: "relative", height: 12 },
                legendLabel: { ...TYPE.monoLabel, color: colors.textMuted, fontSize: 9, position: "absolute", transform: [{ translateX: -12 }] },
            }),
        [colors]
    )
    return (
        <View style={[styles.container, style]}>
            <View style={styles.head}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.verdict}>{verdict}</Text>
            </View>
            <View style={styles.bar}>
                <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
                {markers.map((m, i) => (
                    <View key={`${m.label}-${i}`} style={[styles.marker, { left: `${m.position * 100}%` }]} />
                ))}
            </View>
            <View style={styles.legend}>
                {markers.map((m, i) => (
                    <Text key={`l-${m.label}-${i}`} style={[styles.legendLabel, { left: `${m.position * 100}%` }]}>
                        {m.label}
                    </Text>
                ))}
            </View>
        </View>
    )
}

export default React.memo(RamGauge)
