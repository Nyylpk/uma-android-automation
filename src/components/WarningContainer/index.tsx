import { ReactNode } from "react"
import { StyleProp, ViewStyle } from "react-native"
import NoticeContainer from "../NoticeContainer"

/** Props for WarningContainer. */
interface Props {
    /** Custom style for the container view. */
    style?: StyleProp<ViewStyle>
    /** The content to display inside the container. */
    children: ReactNode
}

/**
 * A reusable component for displaying warnings or errors. Thin wrapper over `NoticeContainer` with the "warning" variant.
 * @param style Optional custom style for the container view.
 * @param children The content to display inside the container.
 * @returns The warning-styled notice container.
 */
const WarningContainer = ({ style, children }: Props) => (
    <NoticeContainer variant="warning" style={style}>
        {children}
    </NoticeContainer>
)

export default WarningContainer
