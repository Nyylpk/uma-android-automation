import { useMemo, ReactNode } from "react"
import { View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native"
import { useTheme } from "../../context/ThemeContext"

/** Visual treatment of the notice. */
export type NoticeVariant = "warning" | "info"

/** Props for NoticeContainer. */
interface Props {
    /** Which color treatment to render - amber "warning" or blue "info". */
    variant: NoticeVariant
    /** Custom style for the container view. */
    style?: StyleProp<ViewStyle>
    /** The content to display inside the container. */
    children: ReactNode
}

/**
 * A reusable callout box for warnings/errors or informational notes, selected by `variant`.
 * Renders text with the variant's default styles if children is a string, otherwise renders children directly.
 * @param variant Which color treatment to render ("warning" or "info").
 * @param style Optional custom style for the container view.
 * @param children The content to display inside the container.
 * @returns The styled notice container.
 */
const NoticeContainer = ({ variant, style, children }: Props) => {
    const { colors } = useTheme()

    const styles = useMemo(() => {
        const c = colors as Record<string, string>
        const palette = variant === "warning" ? { bg: c.warningBg, border: c.warningBorder, text: c.warningText } : { bg: c.infoBg, border: c.infoBorder, text: c.infoText }
        return StyleSheet.create({
            container: {
                backgroundColor: palette.bg,
                borderLeftWidth: 4,
                borderLeftColor: palette.border,
                padding: 12,
                marginTop: 12,
                borderRadius: 8,
            },
            text: {
                fontSize: 14,
                color: palette.text,
                lineHeight: 20,
            },
        })
    }, [colors, variant])

    return <View style={[styles.container, style]}>{typeof children === "string" ? <Text style={styles.text}>{children}</Text> : children}</View>
}

export default NoticeContainer
