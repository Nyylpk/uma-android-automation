import React, { useState, useCallback } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import PageHeader from "../../components/PageHeader"
import { SectionLabel } from "../../components/ui/section-label"
import InfoCallout from "../../components/ui/info-callout"
import TabStrip, { TabStripItem } from "../../components/ui/tab-strip"
import { useTheme } from "../../context/ThemeContext"
import { SPACING } from "../../lib/spacing"
import { skillPlanSettingsPages } from "../SkillPlanSettings/config"
import PlanTab from "./PlanTab"
import StyleSection from "./StyleSection"

/** Ordered list of plan tabs. Keys match `skillPlanSettingsPages` plan keys. */
const TAB_ITEMS: TabStripItem[] = [
    { key: "skillPointCheck", label: skillPlanSettingsPages.skillPointCheck.title },
    { key: "preFinals", label: skillPlanSettingsPages.preFinals.title },
    { key: "careerComplete", label: skillPlanSettingsPages.careerComplete.title },
]

/** Optional route params for deep-linking to a specific plan tab. */
interface SkillsRouteParams {
    /** Initial plan tab key. Falls back to `skillPointCheck` if missing or invalid. */
    tab?: string
}

/**
 * Consolidated Skills page. Hosts global Style settings at the top, a tab strip for the three skill plans, and the active plan's content below.
 * @param route Optional navigation route carrying initial tab params.
 * @returns A scrollable Skills page with three tabs.
 */
const Skills: React.FC<{ route?: { params?: SkillsRouteParams } }> = ({ route }) => {
    const { colors } = useTheme()
    const initialTab = route?.params?.tab && TAB_ITEMS.some((t) => t.key === route.params!.tab) ? route.params!.tab! : "skillPointCheck"
    const [activeKey, setActiveKey] = useState<string>(initialTab)
    const onChange = useCallback((key: string) => setActiveKey(key), [])

    const styles = StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { padding: SPACING.md, gap: SPACING.sm },
    })

    return (
        <View style={styles.container}>
            <PageHeader title="Skills" />
            <ScrollView contentContainerStyle={styles.scroll}>
                <InfoCallout title="How skill spending works">
                    {/* Body content migrates here in the follow-up task. */}
                    <View />
                </InfoCallout>
                <StyleSection />
                <SectionLabel label="Skill Plans" />
                <TabStrip items={TAB_ITEMS} activeKey={activeKey} onChange={onChange} />
                <PlanTab planKey={activeKey} />
            </ScrollView>
        </View>
    )
}

export default Skills
