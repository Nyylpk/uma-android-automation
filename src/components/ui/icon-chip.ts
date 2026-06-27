import { ViewStyle } from "react-native"
import { RADII } from "../../lib/radii"

/**
 * Shared style for the app's 36x36 square icon "chip" button - the header search / menu chips, the theme
 * toggle, and modal close buttons all use it. Splice it into a consumer's `StyleSheet.create` block.
 *
 * @param colors The active theme palette from `useTheme`. Only `surfaceRaised` and `borderHair` are read.
 * @returns The icon-chip `ViewStyle`.
 */
export const iconChipStyle = (colors: { surfaceRaised: string; borderHair: string }): ViewStyle => ({
    width: 36,
    height: 36,
    borderRadius: RADII.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderHair,
})
