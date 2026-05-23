import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { skillPlanSettingsPages } from "../SkillPlanSettings/config"
import { useTheme } from "../../context/ThemeContext"
import { TYPE } from "../../lib/type"
import { SPACING } from "../../lib/spacing"

/** Props for `PlanTab`. */
interface PlanTabProps {
    /** Which plan to render (matches a key in `skillPlanSettingsPages`). */
    planKey: string
}

/**
 * Renders the plan content for a single tab. The follow-up task migrates the existing `SkillPlanSettings` body into this component.
 * @param planKey Plan identifier matching `skillPlanSettingsPages`.
 * @returns A View containing the plan title, trigger caption, and (once migrated) the body.
 */
const PlanTab: React.FC<PlanTabProps> = ({ planKey }) => {
    const { colors } = useTheme()
    const config = skillPlanSettingsPages[planKey]

    const styles = StyleSheet.create({
        head: { paddingHorizontal: SPACING.sm, paddingTop: SPACING.md, gap: 2 },
        title: { ...TYPE.h2, color: colors.text },
        trigger: { ...TYPE.caption, color: colors.textMuted },
        unknown: { ...TYPE.body, color: colors.textMuted, padding: SPACING.md },
    })

    if (!config) {
        return <Text style={styles.unknown}>Unknown plan: {planKey}</Text>
    }

    return (
        <View>
            <View style={styles.head}>
                <Text style={styles.title}>{config.title}</Text>
                <Text style={styles.trigger}>{config.description}</Text>
            </View>
            {/* Body content migrates here in the follow-up task. */}
        </View>
    )
}

export default React.memo(PlanTab)
