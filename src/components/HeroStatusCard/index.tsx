import React, { useMemo } from "react"
import { View, Text, Image, StyleSheet, ImageSourcePropType } from "react-native"
import { useTheme } from "../../context/ThemeContext"
import { TYPE } from "../../lib/type"
import { SPACING } from "../../lib/spacing"
import { RADII } from "../../lib/radii"
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
    /** Press handler for the default Start CTA. Ignored when `cta` is provided. */
    onStart?: () => void
    /** Whether the default Start button is disabled. Defaults to false. Ignored when `cta` is provided. */
    startDisabled?: boolean
    /** Optional custom action rendered on the right side in place of the default Start button. */
    cta?: React.ReactNode
}

const STATUS_LABEL: Record<HeroStatus, string> = {
    ready: "Ready",
    running: "Running",
    stopped: "Stopped",
    error: "Error",
}

const BULLET = "●" // BLACK CIRCLE
const SEPARATOR = "·" // MIDDLE DOT

/**
 * Home dashboard hero card: mascot, status pill, campaign + profile, primary action.
 * Uses a cyan-tinted brand surface with a cyan border to draw the eye and signal
 * the page's primary anchor.
 * @param status Current bot status.
 * @param campaign Active campaign name.
 * @param profile Active profile name.
 * @param metaLine Optional caption rendered beneath the campaign line.
 * @param mascot Mascot image source.
 * @param onStart Press handler for the default Start CTA. Ignored when `cta` is provided.
 * @param startDisabled Whether the default Start button is disabled. Ignored when `cta` is provided.
 * @param cta Optional custom right-side action that replaces the default Start button.
 * @returns A brand-tinted card containing the mascot, status block, and primary action.
 */
const HeroStatusCard: React.FC<HeroStatusCardProps> = ({ status, campaign, profile, metaLine, mascot, onStart, startDisabled = false, cta }) => {
    const { colors } = useTheme()
    // Status pill color: ready/running -> success token, stopped/error -> warning.
    const isHealthy = status === "ready" || status === "running"
    const styles = useMemo(
        () =>
            StyleSheet.create({
                card: {
                    backgroundColor: colors.brandSubtle,
                    borderWidth: 1,
                    borderColor: colors.brandBorder,
                    borderRadius: RADII.xl,
                },
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
        <View style={styles.card}>
            <View style={styles.row}>
                <Image source={mascot} style={styles.mascot} />
                <View style={styles.body}>
                    <Text style={styles.statusPill}>{`${BULLET} ${STATUS_LABEL[status]}`}</Text>
                    <Text style={styles.campaign}>
                        {campaign} {SEPARATOR} {profile}
                    </Text>
                    {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}
                </View>
                {cta ?? (
                    <CustomButton variant="primary" size="sm" onPress={onStart} disabled={startDisabled}>
                        Start
                    </CustomButton>
                )}
            </View>
        </View>
    )
}

export default React.memo(HeroStatusCard)
