import { Modal, Pressable, View, type StyleProp, type ViewStyle } from "react-native"
import { useTheme } from "../../context/ThemeContext"
import { GlassSurface } from "./glass-surface"

/** Props for `GlassModal`. */
export interface GlassModalProps {
    /** Whether the modal is currently visible. */
    visible: boolean
    /** Called when the user requests dismiss (tap outside or Android back). */
    onRequestClose: () => void
    /** Modal content. Rendered above the glass backdrop. */
    children: React.ReactNode
    /** Outer container style for the content card. */
    contentStyle?: StyleProp<ViewStyle>
    /** Set false to skip the tap-outside-to-dismiss behavior. Default true. */
    dismissOnBackdropPress?: boolean
}

/**
 * Modal that replaces the conventional dark rgba scrim with a `GlassSurface` backdrop.
 * Content card sits in the center; tapping the backdrop calls `onRequestClose`.
 *
 * @param props See `GlassModalProps`.
 * @returns React Native Modal wrapped in a glass backdrop.
 */
export const GlassModal = ({ visible, onRequestClose, children, contentStyle, dismissOnBackdropPress = true }: GlassModalProps) => {
    const { colors } = useTheme()
    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
            <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.glassBackdrop }} onPress={dismissOnBackdropPress ? onRequestClose : undefined}>
                <GlassSurface intensity={40} style={{ borderRadius: 16, overflow: "hidden", maxWidth: "90%", maxHeight: "85%" }}>
                    <Pressable onPress={(e) => e.stopPropagation()} style={contentStyle}>
                        {children}
                    </Pressable>
                </GlassSurface>
            </Pressable>
        </Modal>
    )
}
