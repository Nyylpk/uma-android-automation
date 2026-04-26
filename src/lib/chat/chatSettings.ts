import { databaseManager } from "../database"

/**
 * Persistence layer for the user-tunable chat parameters.
 *
 * Lives outside `BotStateContext`, under category `"chat"`, so values are NOT included in settings exports.
 */

export const CHAT_CATEGORY = "chat"

export const SETTING_KEYS = {
    maxOutputTokens: "maxOutputTokens",
    llmCitationCharCap: "llmCitationCharCap",
    modelContextWindow: "modelContextWindow",
} as const

export const DEFAULTS = {
    maxOutputTokens: 768,
    llmCitationCharCap: 2200,
    modelContextWindow: 4096,
} as const

export interface ChatTuning {
    maxOutputTokens: number
    llmCitationCharCap: number
    modelContextWindow: number
}

/** Load all three tuning values from SQLite, falling back to [DEFAULTS] for any that aren't set yet. */
export async function loadChatTuning(): Promise<ChatTuning> {
    try {
        const [maxOut, capRaw, ctx] = await Promise.all([
            databaseManager.loadSetting(CHAT_CATEGORY, SETTING_KEYS.maxOutputTokens),
            databaseManager.loadSetting(CHAT_CATEGORY, SETTING_KEYS.llmCitationCharCap),
            databaseManager.loadSetting(CHAT_CATEGORY, SETTING_KEYS.modelContextWindow),
        ])
        return {
            maxOutputTokens: typeof maxOut === "number" ? maxOut : DEFAULTS.maxOutputTokens,
            llmCitationCharCap: typeof capRaw === "number" ? capRaw : DEFAULTS.llmCitationCharCap,
            modelContextWindow: typeof ctx === "number" ? ctx : DEFAULTS.modelContextWindow,
        }
    } catch {
        return { ...DEFAULTS }
    }
}

/** Persist a single tuning value to SQLite. Fire-and-forget — failures are swallowed (DB layer logs them). */
export function saveTuning<K extends keyof typeof SETTING_KEYS>(key: K, value: number): void {
    databaseManager.saveSetting(CHAT_CATEGORY, SETTING_KEYS[key], value, true).catch(() => undefined)
}

/** Cap a per-citation expanded text snippet to [maxChars], breaking on a word boundary and adding an ellipsis. */
export function trimToCap(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text
    const slice = text.slice(0, maxChars)
    const lastSpace = slice.lastIndexOf(" ")
    return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + "…"
}
