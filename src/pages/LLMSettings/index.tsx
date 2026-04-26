import { useCallback, useEffect, useMemo, useState } from "react"
import { View, ScrollView, StyleSheet, Text, TextInput, NativeModules, NativeEventEmitter, Alert, Linking, Pressable } from "react-native"
import { Check, Trash2 } from "lucide-react-native"
import { useTheme } from "../../context/ThemeContext"
import CustomButton from "../../components/CustomButton"
import CustomSlider from "../../components/CustomSlider"
import PageHeader from "../../components/PageHeader"
import WarningContainer from "../../components/WarningContainer"
import InfoContainer from "../../components/InfoContainer"
import { databaseManager } from "../../lib/database"

const MODEL_URL_SETTING = { category: "chat", key: "modelUrl" } as const
/**
 * Hugging Face access token persistence key. Lives under the "chat" category, not BotStateContext, so it is
 * NOT included in settings exports — a token is a user-specific secret and must never leak into a shared JSON.
 */
const HF_TOKEN_SETTING = { category: "chat", key: "hfToken" } as const
const ACTIVE_MODEL_SETTING = { category: "chat", key: "activeModelFilename" } as const
const MAX_OUTPUT_TOKENS_SETTING = { category: "chat", key: "maxOutputTokens" } as const
const CITATION_CHAR_CAP_SETTING = { category: "chat", key: "llmCitationCharCap" } as const
const MODEL_CONTEXT_WINDOW_SETTING = { category: "chat", key: "modelContextWindow" } as const

/** Known LiteRT community `.task` models. Sizes and filenames verified against the Hugging Face tree views. All
 *  are gated — requires a HF read token with the Gemma license accepted. */
const MODEL_PRESETS: Array<{ label: string; detail: string; url: string }> = [
    {
        label: "Gemma 3 1B (555 MB, fast, weak summaries)",
        detail: "Smallest option. Runs on almost any phone, but paraphrasing quality is limited.",
        url: "https://huggingface.co/litert-community/Gemma3-1B-IT/resolve/main/Gemma3-1B-IT_multi-prefill-seq_q4_ekv2048.task",
    },
    {
        label: "Gemma 3n E2B (3.14 GB, balanced)",
        detail: "Purpose-built for on-device; much better summaries than 1B. Needs ~4 GB free RAM and a fast phone.",
        url: "https://huggingface.co/google/gemma-3n-E2B-it-litert-preview/resolve/main/gemma-3n-E2B-it-int4.task",
    },
    {
        label: "Gemma 3n E4B (4.41 GB, highest quality)",
        detail: "~5B effective params, noticeably better summaries than E2B. Needs ~6 GB free RAM; slow on mid-range phones.",
        url: "https://huggingface.co/google/gemma-3n-E4B-it-litert-preview/resolve/main/gemma-3n-E4B-it-int4.task",
    },
]

const DEFAULT_MODEL_URL = MODEL_PRESETS[0].url

/**
 * Derive the local `.task` filename the downloader will use for [url]. Mirrors `filenameFromUrl` in
 * [LLMChatModule.kt] so the UI can check whether a preset is already downloaded before offering the button.
 */
const filenameFromUrl = (url: string): string => {
    const noQuery = url.split("?")[0].split("#")[0]
    const last = noQuery.substring(noQuery.lastIndexOf("/") + 1).trim()
    return last.endsWith(".task") ? last : "chat-model.task"
}

interface ServiceStatus {
    mediaPipeDownloaded: boolean
    mediaPipeSizeBytes: number
    activeService: string
}

interface DownloadState {
    status: "pending" | "running" | "paused" | "complete" | "failed" | "error"
    bytesDownloaded: number
    bytesTotal: number
    error?: string
}

interface DownloadedModel {
    filename: string
    sizeBytes: number
    lastModifiedMillis: number
}

/**
 * LLM Settings page.
 *
 * Manages the on-device documentation chatbot's generative model: download/cancel/delete MediaPipe `.task` files
 * and pick which downloaded model is active. Retrieve-only search is always available regardless of what happens here.
 */
const LLMSettings = () => {
    const { colors } = useTheme()
    const [status, setStatus] = useState<ServiceStatus | null>(null)
    const [downloadState, setDownloadState] = useState<DownloadState | null>(null)
    const [hfToken, setHfToken] = useState("")
    const [modelUrl, setModelUrl] = useState(DEFAULT_MODEL_URL)
    const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([])
    const [activeModelFilename, setActiveModelFilename] = useState<string | null>(null)
    const [maxOutputTokens, setMaxOutputTokens] = useState<number>(768)
    const [llmCitationCharCap, setLlmCitationCharCap] = useState<number>(2200)
    const [modelContextWindow, setModelContextWindow] = useState<number>(4096)
    const [tuningDefaults, setTuningDefaults] = useState<{ maxOutputTokens: number; llmCitationCharCap: number; modelContextWindow: number } | null>(null)

    const refreshStatus = useCallback(async () => {
        try {
            const s: ServiceStatus = await NativeModules.LLMChatModule.getServiceStatus()
            setStatus(s)
        } catch {
            setStatus(null)
        }
    }, [])

    const refreshModels = useCallback(async () => {
        try {
            const list: DownloadedModel[] = await NativeModules.LLMChatModule.listModels()
            setDownloadedModels(list)
        } catch {
            setDownloadedModels([])
        }
    }, [])

    // Load persisted model URL + HF token + active model selection on mount. Token lives outside BotStateContext so
    // it is never exported.
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const [url, token, active, maxOut, citationCap, ctxWindow] = await Promise.all([
                    databaseManager.loadSetting(MODEL_URL_SETTING.category, MODEL_URL_SETTING.key),
                    databaseManager.loadSetting(HF_TOKEN_SETTING.category, HF_TOKEN_SETTING.key),
                    databaseManager.loadSetting(ACTIVE_MODEL_SETTING.category, ACTIVE_MODEL_SETTING.key),
                    databaseManager.loadSetting(MAX_OUTPUT_TOKENS_SETTING.category, MAX_OUTPUT_TOKENS_SETTING.key),
                    databaseManager.loadSetting(CITATION_CHAR_CAP_SETTING.category, CITATION_CHAR_CAP_SETTING.key),
                    databaseManager.loadSetting(MODEL_CONTEXT_WINDOW_SETTING.category, MODEL_CONTEXT_WINDOW_SETTING.key),
                ])
                if (cancelled) return
                if (typeof url === "string" && url.length > 0) setModelUrl(url)
                if (typeof token === "string" && token.length > 0) setHfToken(token)
                if (typeof active === "string" && active.length > 0) {
                    setActiveModelFilename(active)
                    NativeModules.LLMChatModule.setActiveModel(active)
                }
                // Pull current values + defaults from native, then overlay any persisted overrides.
                try {
                    const native = await NativeModules.LLMChatModule.getGenerationTuning()
                    if (!cancelled) {
                        setTuningDefaults({
                            maxOutputTokens: native.defaultMaxOutputTokens,
                            llmCitationCharCap: native.defaultLlmCitationCharCap,
                            modelContextWindow: native.defaultModelContextWindow,
                        })
                        const moT = typeof maxOut === "number" ? maxOut : native.maxOutputTokens
                        const cap = typeof citationCap === "number" ? citationCap : native.llmCitationCharCap
                        const ctx = typeof ctxWindow === "number" ? ctxWindow : native.modelContextWindow
                        setMaxOutputTokens(moT)
                        setLlmCitationCharCap(cap)
                        setModelContextWindow(ctx)
                        // Push persisted overrides back into native so the orchestrator picks them up.
                        if (typeof maxOut === "number") NativeModules.LLMChatModule.setMaxOutputTokens(moT)
                        if (typeof citationCap === "number") NativeModules.LLMChatModule.setLlmCitationCharCap(cap)
                        if (typeof ctxWindow === "number") NativeModules.LLMChatModule.setModelContextWindow(ctx)
                    }
                } catch {
                    // Native module unavailable — keep React defaults.
                }
            } catch {
                // First run or DB not initialized — keep defaults.
            }
            refreshModels()
        })()
        return () => {
            cancelled = true
        }
    }, [refreshModels])

    const handleSelectActiveModel = useCallback(
        (filename: string) => {
            setActiveModelFilename(filename)
            NativeModules.LLMChatModule.setActiveModel(filename)
            databaseManager.saveSetting(ACTIVE_MODEL_SETTING.category, ACTIVE_MODEL_SETTING.key, filename, true).catch(() => undefined)
            refreshStatus()
        },
        [refreshStatus]
    )

    const handleDeleteModelFile = useCallback(
        (filename: string) => {
            Alert.alert("Delete this model?", `Removes ${filename} (~${(downloadedModels.find((m) => m.filename === filename)?.sizeBytes ?? 0) / 1024 / 1024 | 0} MB) from disk.`, [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await NativeModules.LLMChatModule.deleteModelFile(filename)
                        if (activeModelFilename === filename) {
                            setActiveModelFilename(null)
                            NativeModules.LLMChatModule.setActiveModel("")
                            databaseManager.saveSetting(ACTIVE_MODEL_SETTING.category, ACTIVE_MODEL_SETTING.key, "", true).catch(() => undefined)
                        }
                        await refreshModels()
                        await refreshStatus()
                    },
                },
            ])
        },
        [activeModelFilename, downloadedModels, refreshModels, refreshStatus]
    )

    /** Commit a tuning value to native, persist to DB, and update the local React state. */
    const commitMaxOutputTokens = useCallback((value: number) => {
        setMaxOutputTokens(value)
        NativeModules.LLMChatModule.setMaxOutputTokens(value)
        databaseManager.saveSetting(MAX_OUTPUT_TOKENS_SETTING.category, MAX_OUTPUT_TOKENS_SETTING.key, value, true).catch(() => undefined)
    }, [])

    const commitLlmCitationCharCap = useCallback((value: number) => {
        setLlmCitationCharCap(value)
        NativeModules.LLMChatModule.setLlmCitationCharCap(value)
        databaseManager.saveSetting(CITATION_CHAR_CAP_SETTING.category, CITATION_CHAR_CAP_SETTING.key, value, true).catch(() => undefined)
    }, [])

    const commitModelContextWindow = useCallback((value: number) => {
        setModelContextWindow(value)
        NativeModules.LLMChatModule.setModelContextWindow(value)
        databaseManager.saveSetting(MODEL_CONTEXT_WINDOW_SETTING.category, MODEL_CONTEXT_WINDOW_SETTING.key, value, true).catch(() => undefined)
    }, [])

    const handleResetTuning = useCallback(() => {
        if (!tuningDefaults) return
        commitMaxOutputTokens(tuningDefaults.maxOutputTokens)
        commitLlmCitationCharCap(tuningDefaults.llmCitationCharCap)
        commitModelContextWindow(tuningDefaults.modelContextWindow)
    }, [tuningDefaults, commitMaxOutputTokens, commitLlmCitationCharCap, commitModelContextWindow])

    /** Warn when the active model's filename advertises a baked-in KV cache smaller than the requested context window
     *  — only relevant for Gemma `_ekvN.task` files where N caps the engine. */
    const ekvCapWarning = useMemo(() => {
        const active = activeModelFilename ?? downloadedModels[0]?.filename
        if (!active) return null
        const match = active.match(/_ekv(\d+)\b/i)
        if (!match) return null
        const ekv = parseInt(match[1], 10)
        return modelContextWindow > ekv ? `Active model is exported with KV cache ${ekv}; values above ${ekv} have no effect for this file.` : null
    }, [activeModelFilename, downloadedModels, modelContextWindow])

    const persistHfToken = useCallback((value: string) => {
        setHfToken(value)
        databaseManager.saveSetting(HF_TOKEN_SETTING.category, HF_TOKEN_SETTING.key, value, true).catch(() => undefined)
    }, [])

    const persistModelUrl = useCallback((url: string) => {
        setModelUrl(url)
        databaseManager.saveSetting(MODEL_URL_SETTING.category, MODEL_URL_SETTING.key, url, true).catch(() => undefined)
    }, [])


    useEffect(() => {
        refreshStatus()
        const emitter = new NativeEventEmitter(NativeModules.LLMChatModule)
        const sub = emitter.addListener("LLMChatModule.DownloadState", (state: DownloadState) => {
            setDownloadState(state)
            if (state.status === "complete" || state.status === "failed" || state.status === "error") {
                refreshStatus()
                refreshModels()
            }
        })
        return () => sub.remove()
    }, [refreshStatus, refreshModels])

    const handleDownload = useCallback(() => {
        const preset = MODEL_PRESETS.find((p) => p.url === modelUrl)
        const title = preset ? `Download ${preset.label.split(" (")[0]}?` : "Download custom model?"
        const body = preset
            ? `${preset.label}\n\n${preset.detail}\n\nGated on Hugging Face — accept the license on the model page and paste a read-access token below before downloading. Prefer Wi-Fi.`
            : `Downloading from:\n${modelUrl}\n\nGated models require an accepted license and a read-access token. Prefer Wi-Fi.`
        Alert.alert(title, body, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Download",
                onPress: async () => {
                    try {
                        NativeModules.LLMChatModule.setAuthToken(hfToken.trim())
                        await NativeModules.LLMChatModule.downloadModel(modelUrl.trim() || DEFAULT_MODEL_URL)
                    } catch (e: any) {
                        Alert.alert("Download failed to start", e?.message ?? "Unknown error")
                    }
                },
            },
        ])
    }, [hfToken, modelUrl])

    const handleCancel = useCallback(async () => {
        await NativeModules.LLMChatModule.cancelDownload()
        setDownloadState(null)
    }, [])

    const handleDelete = useCallback(() => {
        Alert.alert("Delete chat model?", "This frees ~530 MB. You can re-download it later.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    await NativeModules.LLMChatModule.deleteModel()
                    await refreshStatus()
                },
            },
        ])
    }, [refreshStatus])

    const isDownloading = downloadState?.status === "running" || downloadState?.status === "pending" || downloadState?.status === "paused"

    const selectedFilename = useMemo(() => filenameFromUrl(modelUrl), [modelUrl])
    const selectedAlreadyDownloaded = useMemo(() => downloadedModels.some((m) => m.filename === selectedFilename), [downloadedModels, selectedFilename])

    const progressText = useMemo(() => {
        if (!downloadState) return null
        if (downloadState.status === "complete") return "Download complete."
        if (downloadState.status === "failed" || downloadState.status === "error") return `Download failed${downloadState.error ? ` (${downloadState.error})` : ""}.`
        const total = downloadState.bytesTotal
        const done = downloadState.bytesDownloaded
        if (total > 0) {
            const pct = Math.round((done / total) * 100)
            return `Downloading: ${pct}% (${(done / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB)`
        }
        return "Preparing download..."
    }, [downloadState])

    const styles = useMemo(
        () =>
            StyleSheet.create({
                root: { flex: 1, margin: 10, backgroundColor: colors.background },
                section: { marginTop: 14 },
                sectionLabel: { fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 6 },
                statusRow: { color: colors.foreground, marginBottom: 4 },
                hint: { fontSize: 11, color: colors.mutedForeground, marginTop: 4 },
                linkRowContainer: { flexDirection: "row" as const, gap: 16, marginTop: 4 },
                linkRow: { paddingVertical: 10 },
                link: { fontSize: 14, color: colors.primary, textDecorationLine: "underline" as const },
                tokenInput: {
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    marginTop: 6,
                },
                presetCard: {
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    marginTop: 6,
                    backgroundColor: colors.card,
                },
                presetCardSelected: { borderColor: colors.primary, borderWidth: 2 },
                presetLabel: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
                presetDetail: { color: colors.mutedForeground, fontSize: 11, marginTop: 2 },
                modelRow: {
                    flexDirection: "row" as const,
                    alignItems: "center" as const,
                    justifyContent: "space-between" as const,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    marginTop: 6,
                    backgroundColor: colors.card,
                },
                modelRowActive: { borderColor: colors.primary, borderWidth: 2 },
                modelInfo: { flex: 1, marginRight: 8 },
                modelFilename: { color: colors.foreground, fontSize: 13, fontWeight: "600" as const },
                modelMeta: { color: colors.mutedForeground, fontSize: 11, marginTop: 2 },
                modelActions: { flexDirection: "row" as const, gap: 6 },
                modelActionButton: {
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: colors.border,
                },
                modelActionText: { color: colors.foreground, fontSize: 12 },
                modelActionActiveText: { color: colors.primary, fontSize: 12, fontWeight: "600" as const },
                activeBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, paddingHorizontal: 4 },
                tuningHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
                warningHint: { fontSize: 11, color: colors.warningBorder ?? colors.foreground, marginTop: 6 },
                buttonRow: { flexDirection: "row", gap: 8, marginTop: 8 },
            }),
        [colors]
    )

    return (
        <View style={styles.root}>
            <PageHeader title="LLM Settings" />
            <ScrollView>
                <InfoContainer>Retrieve-only search always works. The options below add optional natural-language answers backed by an on-device model.</InfoContainer>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>MediaPipe Chat Model</Text>
                    <Text style={styles.statusRow}>
                        {downloadedModels.length > 0
                            ? `${downloadedModels.length} model${downloadedModels.length === 1 ? "" : "s"} downloaded · active: ${activeModelFilename ?? downloadedModels[0].filename}`
                            : "Not downloaded"}
                    </Text>
                    <>
                        <Text style={styles.hint}>
                            All models are gated on Hugging Face. Accept the license on the model's page, then create a read-access token and paste it below. Bigger models summarize better but
                            need more RAM and download time.
                        </Text>
                            {MODEL_PRESETS.map((p) => {
                                const selected = modelUrl === p.url
                                return (
                                    <Pressable key={p.url} style={[styles.presetCard, selected && styles.presetCardSelected]} onPress={() => persistModelUrl(p.url)}>
                                        <Text style={styles.presetLabel}>{p.label}</Text>
                                        <Text style={styles.presetDetail}>{p.detail}</Text>
                                    </Pressable>
                                )
                            })}
                            <View style={styles.linkRowContainer}>
                                <Pressable style={styles.linkRow} onPress={() => Linking.openURL(modelUrl.replace(/\/resolve\/main\/.*$/, ""))}>
                                    <Text style={styles.link}>Open selected model page</Text>
                                </Pressable>
                                <Pressable style={styles.linkRow} onPress={() => Linking.openURL("https://huggingface.co/settings/tokens")}>
                                    <Text style={styles.link}>Create token</Text>
                                </Pressable>
                            </View>
                            <TextInput
                                style={styles.tokenInput}
                                value={hfToken}
                                onChangeText={persistHfToken}
                                placeholder="hf_... (Hugging Face read token)"
                                placeholderTextColor={colors.mutedForeground}
                                autoCapitalize="none"
                                autoCorrect={false}
                                secureTextEntry
                            />
                            <TextInput
                                style={styles.tokenInput}
                                value={modelUrl}
                                onChangeText={persistModelUrl}
                                placeholder="Model .task URL"
                                placeholderTextColor={colors.mutedForeground}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                    </>
                    {progressText && <Text style={styles.hint}>{progressText}</Text>}
                    <View style={styles.buttonRow}>
                        {!isDownloading && (
                            <CustomButton variant="primary" onPress={handleDownload} disabled={selectedAlreadyDownloaded}>
                                {selectedAlreadyDownloaded ? "Already downloaded" : downloadedModels.length > 0 ? "Download another model" : "Download"}
                            </CustomButton>
                        )}
                        {isDownloading && (
                            <CustomButton variant="destructive" onPress={handleCancel}>
                                Cancel
                            </CustomButton>
                        )}
                    </View>
                </View>

                {downloadedModels.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Downloaded Models</Text>
                        <Text style={styles.hint}>Tap Use to switch the active chat model. Keep multiple variants so you can A/B without re-downloading.</Text>
                        {downloadedModels.map((m) => {
                            const isActive = (activeModelFilename ?? downloadedModels[0]?.filename) === m.filename
                            return (
                                <View key={m.filename} style={[styles.modelRow, isActive && styles.modelRowActive]}>
                                    <View style={styles.modelInfo}>
                                        <Text style={styles.modelFilename} numberOfLines={1}>
                                            {m.filename}
                                        </Text>
                                        <Text style={styles.modelMeta}>{(m.sizeBytes / 1024 / 1024).toFixed(0)} MB</Text>
                                    </View>
                                    <View style={styles.modelActions}>
                                        {isActive ? (
                                            <View style={styles.activeBadge}>
                                                <Check size={14} color={colors.primary} />
                                                <Text style={styles.modelActionActiveText}>Active</Text>
                                            </View>
                                        ) : (
                                            <Pressable style={styles.modelActionButton} onPress={() => handleSelectActiveModel(m.filename)}>
                                                <Text style={styles.modelActionText}>Use</Text>
                                            </Pressable>
                                        )}
                                        <Pressable
                                            style={styles.modelActionButton}
                                            onPress={() => handleDeleteModelFile(m.filename)}
                                            accessibilityLabel={`Delete ${m.filename}`}
                                            accessibilityRole="button"
                                        >
                                            <Trash2 size={14} color={colors.foreground} />
                                        </Pressable>
                                    </View>
                                </View>
                            )
                        })}
                    </View>
                )}

                <View style={styles.section}>
                    <View style={styles.tuningHeader}>
                        <Text style={styles.sectionLabel}>Generation Tuning</Text>
                        {tuningDefaults && (
                            <Pressable onPress={handleResetTuning} style={styles.linkRow}>
                                <Text style={styles.link}>Reset to defaults</Text>
                            </Pressable>
                        )}
                    </View>
                    <Text style={styles.hint}>
                        Bigger numbers = longer, slower answers. Changes apply to the next chat call. Engine context window changes reload the loaded model.
                    </Text>
                    <CustomSlider
                        label="Max output tokens"
                        description="Upper bound on answer length. 768 default is enough for 4–10 sentences; 1024+ slows generation noticeably on phones."
                        value={maxOutputTokens}
                        onValueChange={setMaxOutputTokens}
                        onSlidingComplete={commitMaxOutputTokens}
                        min={128}
                        max={2048}
                        step={64}
                    />
                    <CustomSlider
                        label="Context per citation (chars)"
                        description="How much of each retrieved doc section is fed to the LLM. Larger gives the model more to summarize from but eats KV cache budget."
                        value={llmCitationCharCap}
                        onValueChange={setLlmCitationCharCap}
                        onSlidingComplete={commitLlmCitationCharCap}
                        min={500}
                        max={4000}
                        step={100}
                    />
                    <CustomSlider
                        label="Model context window (tokens)"
                        description="Engine KV cache size. 4096 default fits 4 expanded citations + scaffold + 768 output. Raising this requires the model to support it."
                        value={modelContextWindow}
                        onValueChange={setModelContextWindow}
                        onSlidingComplete={commitModelContextWindow}
                        min={2048}
                        max={16384}
                        step={1024}
                    />
                    {ekvCapWarning && <Text style={styles.warningHint}>{ekvCapWarning}</Text>}
                </View>

                <WarningContainer>Generated answers may occasionally be wrong or phrased imprecisely. A verifier guards against clear hallucinations by falling back to showing the source text verbatim, but always cross-check important answers against the full docs.</WarningContainer>
            </ScrollView>
        </View>
    )
}

export default LLMSettings
