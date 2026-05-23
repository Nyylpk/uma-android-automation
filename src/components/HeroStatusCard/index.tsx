import React, { useMemo } from "react"
import { View, Text, Image, StyleSheet, ImageSourcePropType } from "react-native"
import { useTheme } from "../../context/ThemeContext"
import { TYPE } from "../../lib/type"
import { SPACING } from "../../lib/spacing"
import { RADII } from "../../lib/radii"
import { GlassSurface } from "../ui/glass-surface"
import CustomButton from "../CustomButton"

/** Bot run states surfaced on the hero card. */
export type HeroStatus = "ready" | "running" | "stopped" | "error"

/** Props for `HeroStatusCard`. */
export interface HeroStatusCardProps {
    /** Current bot status pill. */
    status: HeroStatus
    /** Active campaign name (e.g. "Trackblazer"). */
    campaign: string
    /** Active profile name (e.g. "Default"). */
    profile: string
    /** Optional secondary line (e.g. "Last run - 2h ago - 5 races"). */
    metaLine?: string
    /** Mascot image source. */
    mascot: ImageSourcePropType
    /** Press handler for the primary Start CTA. */
    onStart: () => void
    /** Whether the Start CTA is disabled. Defaults to false. */
    startDisabled?: boolean
}

const STATUS_LABEL: Record<HeroStatus, string> = {
    ready: "Ready",
    running: "Running",
    stopped: "Stopped",
    error: "Error",
}

/**
 * Home dashboard hero card: mascot, status pill, campaign + profile, primary Start CTA.
 * @param status Current bot status.
 * @param campaign Active campaign name.
 * @param profile Active profile name.
 * @param metaLine Optional caption rendered beneath the campaign line.
 * @param mascot Mascot image source.
 * @param onStart Press handler for the Start CTA.
 * @param startDisabled Whether the Start button is disabled. Defaults to false.
 * @returns A glass-surfaced row containing the mascot, status block, and Start button.
 */
const HeroStatusCard: React.FC<HeroStatusCardProps> = ({ status, campaign, profile, metaLine, mascot, onStart, startDisabled = false }) => {
    const { colors } = useTheme()
    // Status pill color: ready/running -> success token, stopped/error -> warning.
    const isHealthy = status === "ready" || status === "running"
    const styles = useMemo(
        () =>
            StyleSheet.create({
                row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md },
                mascot: { width: 56, height: 56, borderRadius: 999 },
                body: { flex: 1, gap: 2 },
                statusPill: {
                    ...TYPE.monoLabel,
                    color: isHealthy ? colors.success : colors.warning,
                    alignSelf: "flex-start",
                    paddingHorizontal: SPACING.sm,
                    paddingVertical: 2,
                    backgroundColor: isHealthy ? colors.successSubtle : colors.warningSubtle,
                    borderRadius: RADII.pill,
                },
                campaign: { ...TYPE.h2, color: colors.text },
                meta: { ...TYPE.caption, color: colors.textMuted },
            }),
        [colors, isHealthy]
    )
    return (
        <GlassSurface>
            <View style={styles.row}>
                <Image source={mascot} style={styles.mascot} />
                <View style={styles.body}>
                    <Text style={styles.statusPill}>{`● ${STATUS_LABEL[status]}`}</Text>
                    <Text style={styles.campaign}>
                        {campaign} - {profile}
                    </Text>
                    {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}
                </View>
                <CustomButton variant="primary" size="sm" onPress={onStart} isLoading={false} disabled={startDisabled}>
                    Start
                </CustomButton>
            </View>
        </GlassSurface>
    )
}

export default React.memo(HeroStatusCard)
