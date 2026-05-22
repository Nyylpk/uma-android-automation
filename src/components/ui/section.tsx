import { useState, useMemo, Children } from "react"
import { LayoutAnimation, Pressable, View, type StyleProp, type ViewStyle } from "react-native"
import { Ionicons } from "@react-native-vector-icons/ionicons"
import { useTheme } from "../../context/ThemeContext"
import { SPACING } from "../../lib/spacing"
import { RADII } from "../../lib/radii"
import { SectionLabel } from "./section-label"

/** Props for `Section`. */
export interface SectionProps {
    /** Uppercase label rendered via `SectionLabel`. */
    label: string
    /** Child rows. Hairline dividers are drawn between adjacent children. */
    children: React.ReactNode
    /** Allow the user to collapse this section. Default: false (always open). */
    collapsible?: boolean
    /** Initial open state when `collapsible`. Default: true (open). */
    defaultOpen?: boolean
    /** Outer container style override. */
    style?: StyleProp<ViewStyle>
}

/**
 * Linear-style labeled section. Uppercase mono label above a card with hairline dividers between children.
 * Optional collapse via a chevron on the label.
 *
 * @param props See `SectionProps`.
 * @returns Label + card with children stacked vertically.
 */
export const Section = ({ label, children, collapsible = false, defaultOpen = true, style }: SectionProps) => {
    const { colors } = useTheme()
    const [open, setOpen] = useState(defaultOpen)
    const items = useMemo(() => Children.toArray(children).filter(Boolean), [children])

    const toggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.create(200, "easeInEaseOut", "opacity"))
        setOpen((v) => !v)
    }

    const chevron = collapsible ? (
        <Pressable onPress={toggle} hitSlop={8}>
            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
        </Pressable>
    ) : null

    return (
        <View style={[{ marginBottom: SPACING.lg }, style]}>
            <SectionLabel label={label} right={chevron} />
            {open ? (
                <View style={{ backgroundColor: colors.surface, borderRadius: RADII.lg, borderWidth: 1, borderColor: colors.borderHair, overflow: "hidden" }}>
                    {items.map((child, idx) => (
                        <View key={idx}>
                            {child}
                            {idx < items.length - 1 ? <View style={{ height: 1, backgroundColor: colors.borderHair, marginLeft: SPACING.lg }} /> : null}
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    )
}
