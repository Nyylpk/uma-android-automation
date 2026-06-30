/** A named dating-schedule preset that fills the recreation calendar in one tap. */
export interface DatingSchedulePreset {
    /** Display label shown in the preset selector and the settings banner. */
    label: string
    /** Career turns (1-72) pinned for regular recreation outings - one per outing in the chain except the held final. */
    recreationTurns: number[]
    /** Career turn pinned for the single final outing that triggers Pure Passion. */
    purePassionTurn: number
    /** Length of the card's recreation chain - drives the hold-final counter so the last outing is saved for the Pure Passion date. */
    totalOutings: number
}

/** Preset key meaning the user hand-edited the calendar, so no built-in preset turns apply. */
export const DATING_SCHEDULE_CUSTOM = "custom"

/**
 * Built-in dating-schedule presets, keyed by a stable id stored in settings. Each preset is card-specific. The Heirs to the Throne preset holds its final outing
 * for a Pure Passion turn late in the Senior year so the ~3-turn buff lands on Senior summer camp (the timing uma.guide recommends). The Team Sirius preset pins
 * every recreation date and sets no Pure Passion turn, since Pure Passion summer-timing applies only to Heirs to the Throne. Each preset sets `totalOutings` to match its card.
 */
export const DATING_SCHEDULE_PRESETS: Record<string, DatingSchedulePreset> = {
    siriusSenior: {
        label: "Team Sirius",
        recreationTurns: [29, 35, 43, 47, 52, 55, 58],
        purePassionTurn: -1,
        totalOutings: 7,
    },
    throneSenior: {
        label: "Heirs to the Throne - Senior Summer",
        recreationTurns: [35, 43, 52, 58],
        purePassionTurn: 60,
        totalOutings: 4,
    },
}
