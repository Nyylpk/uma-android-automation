import { useCallback, useEffect, useMemo, useState } from "react"
import { View, ScrollView, StyleSheet, Text, TextInput, NativeModules, NativeEventEmitter, Alert, Linking } from "react-native"
import { useTheme } from "../../context/ThemeContext"
import CustomButton from "../../components/CustomButton"
import CustomCheckbox from "../../components/CustomCheckbox"
import PageHeader from "../../components/PageHeader"
import WarningContainer from "../../components/WarningContainer"
import InfoContainer from "../../components/InfoContainer"

// ML Kit FeatureStatus codes (mirrors com.google.mlkit.genai.common.FeatureStatus).
const NANO_STATUS_UNAVAILABLE = 0
const NANO_STATUS_DOWNLOADABLE = 1
const NANO_STATUS_DOWNLOADING = 2
const NANO_STATUS_AVAILABLE = 3

/** Default URL of the Gemma 3 1B .task model — user-overridable via a future settings field. */
const DEFAULT_MODEL_URL = "https://huggingface.co/litert-community/Gemma3-1B-IT/resolve/main/Gemma3-1B-IT_multi-prefill-seq_q4_ekv2048.task"

interface ServiceStatus {
    nanoStatus: number
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

/**
 * LLM Settings page.
 *
 * Manages the on-device documentation chatbot's generative model: download/cancel/delete the MediaPipe Gemma 3 1B
 * file (~530 MB), toggle Gemini Nano preference, and display current service availability. Retrieve-only search is
 * always available regardless of what happens here.
 */
const LLMSettings = () => {
    const { colors } = useTheme()
    const [status, setStatus] = useState<ServiceStatus | null>(null)
    const [downloadState, setDownloadState] = useState<DownloadState | null>(null)
    const [preferNano, setPreferNano] = useState(true)
    const [hfToken, setHfToken] = useState("")

    const refreshStatus = useCallback(async () => {
        try {
            const s: ServiceStatus = await NativeModules.LLMChatModule.getServiceStatus()
            setStatus(s)
        } catch {
            setStatus(null)
        }
    }, [])

    useEffect(() => {
        refreshStatus()
        const emitter = new NativeEventEmitter(NativeModules.LLMChatModule)
        const sub = emitter.addListener("LLMChatModule.DownloadState", (state: DownloadState) => {
            setDownloadState(state)
            if (state.status === "complete" || state.status === "failed" || state.status === "error") {
                refreshStatus()
            }
        })
        return () => sub.remove()
    }, [refreshStatus])

    const handleDownload = useCallback(() => {
        Alert.alert(
            "Download chat model?",
            "This downloads ~530 MB over Wi-Fi. The Gemma 3 1B model is gated on Hugging Face — you must accept Google's Gemma license on the model page and paste a read-access token below before downloading.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Download",
                    onPress: async () => {
                        try {
                            NativeModules.LLMChatModule.setAuthToken(hfToken.trim())
                            await NativeModules.LLMChatModule.downloadModel(DEFAULT_MODEL_URL)
                        } catch (e: any) {
                            Alert.alert("Download failed to start", e?.message ?? "Unknown error")
                        }
                    },
                },
            ]
        )
    }, [hfToken])

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

    const handleTogglePreferNano = useCallback(
        (next: boolean) => {
            setPreferNano(next)
            NativeModules.LLMChatModule.setPreferNano(next)
            refreshStatus()
        },
        [refreshStatus]
    )

    const nanoLabel = useMemo(() => {
        switch (status?.nanoStatus) {
            case NANO_STATUS_AVAILABLE:
                return "Available"
            case NANO_STATUS_DOWNLOADABLE:
                return "Downloadable via system"
            case NANO_STATUS_DOWNLOADING:
                return "Downloading..."
            case NANO_STATUS_UNAVAILABLE:
            default:
                return "Unavailable on this device"
        }
    }, [status?.nanoStatus])

    const isDownloading = downloadState?.status === "running" || downloadState?.status === "pending" || downloadState?.status === "paused"

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
                link: { fontSize: 11, color: colors.primary, marginTop: 4, textDecorationLine: "underline" },
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
                    <Text style={styles.sectionLabel}>Gemini Nano (system)</Text>
                    <Text style={styles.statusRow}>{nanoLabel}</Text>
                    <CustomCheckbox checked={preferNano} onCheckedChange={handleTogglePreferNano} label="Prefer Gemini Nano when available" />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>MediaPipe Chat Model</Text>
                    <Text style={styles.statusRow}>
                        {status?.mediaPipeDownloaded ? `Downloaded (${(status.mediaPipeSizeBytes / 1024 / 1024).toFixed(0)} MB)` : "Not downloaded"}
                    </Text>
                    {!status?.mediaPipeDownloaded && (
                        <>
                            <Text style={styles.hint}>
                                Gemma 3 1B is gated. Accept the license on the Hugging Face model page, then create a read-access token and paste it below.
                            </Text>
                            <Text style={styles.link} onPress={() => Linking.openURL("https://huggingface.co/litert-community/Gemma3-1B-IT")}>
                                Open model page
                            </Text>
                            <Text style={styles.link} onPress={() => Linking.openURL("https://huggingface.co/settings/tokens")}>
                                Create token
                            </Text>
                            <TextInput
                                style={styles.tokenInput}
                                value={hfToken}
                                onChangeText={setHfToken}
                                placeholder="hf_... (Hugging Face read token)"
                                placeholderTextColor={colors.mutedForeground}
                                autoCapitalize="none"
                                autoCorrect={false}
                                secureTextEntry
                            />
                        </>
                    )}
                    {progressText && <Text style={styles.hint}>{progressText}</Text>}
                    <View style={styles.buttonRow}>
                        {!status?.mediaPipeDownloaded && !isDownloading && (
                            <CustomButton variant="primary" onPress={handleDownload}>
                                Download (~530 MB)
                            </CustomButton>
                        )}
                        {isDownloading && (
                            <CustomButton variant="destructive" onPress={handleCancel}>
                                Cancel
                            </CustomButton>
                        )}
                        {status?.mediaPipeDownloaded && !isDownloading && (
                            <CustomButton variant="destructive" onPress={handleDelete}>
                                Delete model
                            </CustomButton>
                        )}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Active Path</Text>
                    <Text style={styles.statusRow}>{status?.activeService ?? "loading..."}</Text>
                </View>

                <WarningContainer>Generated answers may occasionally be wrong or phrased imprecisely. A verifier guards against clear hallucinations by falling back to showing the source text verbatim, but always cross-check important answers against the full docs.</WarningContainer>
            </ScrollView>
        </View>
    )
}

export default LLMSettings
