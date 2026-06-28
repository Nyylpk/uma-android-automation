import { ReactNode } from "react"
import { StyleProp, ViewStyle } from "react-native"
import NoticeContainer from "../NoticeContainer"

/** Props for InfoContainer. */
interface Props {
    /** Custom style for the container view. */
    style?: StyleProp<ViewStyle>
    /** The content to display inside the container. Can be a string or a ReactNode. */
    children: ReactNode
}

/**
 * A reusable component for displaying informational content. Thin wrapper over `NoticeContainer` with the "info" variant.
 * @param style Optional custom style for the container view.
 * @param children The content to display inside the container. Can be a string or a ReactNode.
 * @returns The info-styled notice container.
 */
const InfoContainer = ({ style, children }: Props) => (
    <NoticeContainer variant="info" style={style}>
        {children}
    </NoticeContainer>
)

export default InfoContainer
