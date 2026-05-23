import React from "react"
import { View } from "react-native"
import { SectionLabel } from "../../components/ui/section-label"
import InfoCallout from "../../components/ui/info-callout"

/**
 * Global Style settings - the Running Style override picker that applies to all plans. The follow-up task migrates the existing Running Style select + explainer here.
 * @returns A section containing the running style picker and explainer callout.
 */
const StyleSection: React.FC = () => {
    return (
        <>
            <SectionLabel label="Style" />
            {/* The Running Style select from SkillSettings/index.tsx migrates here in the follow-up task. */}
            <InfoCallout title="How Running Style affects skill picks">
                {/* Explainer body content migrates here in the follow-up task. */}
                <View />
            </InfoCallout>
        </>
    )
}

export default React.memo(StyleSection)
