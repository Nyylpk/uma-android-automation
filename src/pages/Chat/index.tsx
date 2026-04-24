import { useCallback, useMemo, useState } from "react"
import { View, ScrollView, StyleSheet, TextInput, Text, NativeModules } from "react-native"
import { useTheme } from "../../context/ThemeContext"
import CustomButton from "../../components/CustomButton"
import PageHeader from "../../components/PageHeader"

interface DocResult {
    id: string
    source: string
    heading: string
    text: string
    score: number
}

interface ChatResult {
    answer: string
    mode: "generated" | "retrieveOnly" | "verifierFallback"
    service?: string
    overlap?: number
    rejectedAnswer?: string
    citations: DocResult[]
}

/**
 * Ask-the-docs chat page.
 *
 * Calls [LLMChatModule.chat] which runs the full RAG pipeline: retrieve → (optionally) generate → verify. The UI
 * badges each answer with its provenance so users can tell at a glance whether the text is verbatim from the docs,
 * paraphrased by an on-device model, or a fallback after the verifier rejected a suspect answer.
 */
const Chat = () => {
    const { colors } = useTheme()
    const [query, setQuery] = useState("")
    const [result, setResult] = useState<ChatResult | null>(null)
    const [isSearching, setIsSearching] = useState(false)
    const [searched, setSearched] = useState(false)

    const handleSearch = useCallback(async () => {
        const q = query.trim()
        if (!q) return
        setIsSearching(true)
        setSearched(true)
        try {
            const raw = (await NativeModules.LLMChatModule.chat(q, 4)) as ChatResult
            setResult(raw)
        } catch {
            setResult(null)
        } finally {
            setIsSearching(false)
        }
    }, [query])

    const modeLabel = useMemo(() => {
        if (!result) return null
        switch (result.mode) {
            case "generated":
                return `Generated via ${result.service ?? "model"} · grounding ${Math.round((result.overlap ?? 0) * 100)}%`
            case "retrieveOnly":
                return "Verbatim from docs (no model)"
            case "verifierFallback":
                return `Verifier rejected generated answer (${Math.round((result.overlap ?? 0) * 100)}% grounding). Showing source instead.`
        }
    }, [result])

    const styles = useMemo(
        () =>
            StyleSheet.create({
                root: { flex: 1, margin: 10, backgroundColor: colors.background },
                inputColumn: { gap: 8, marginVertical: 10 },
                input: {
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    minHeight: 96,
                    maxHeight: 200,
                    textAlignVertical: "top",
                },
                answerCard: {
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 12,
                    backgroundColor: colors.card,
                },
                answerText: { color: colors.foreground, fontSize: 15, lineHeight: 22 },
                modeLabel: { fontSize: 11, color: colors.mutedForeground, marginTop: 8, fontStyle: "italic" },
                sectionLabel: { fontSize: 13, fontWeight: "600", color: colors.foreground, marginTop: 10, marginBottom: 6 },
                resultCard: {
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 6,
                    padding: 10,
                    marginBottom: 8,
                    backgroundColor: colors.card,
                },
                resultHeading: { fontWeight: "600", color: colors.foreground, marginBottom: 4 },
                resultMeta: { fontSize: 11, color: colors.mutedForeground, marginBottom: 6 },
                resultText: { color: colors.foreground },
                emptyText: { color: colors.mutedForeground, textAlign: "center", marginTop: 20, paddingHorizontal: 20 },
                disclaimer: { fontSize: 11, color: colors.mutedForeground, marginTop: 4, marginBottom: 8, fontStyle: "italic" },
            }),
        [colors]
    )

    return (
        <View style={styles.root}>
            <PageHeader title="Ask the Docs" />
            <Text style={styles.disclaimer}>Answers are grounded in README.md, HOW_IT_WORKS.md, and in-app option descriptions. Fully offline.</Text>

            <View style={styles.inputColumn}>
                <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Ask a question about the app..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    textAlignVertical="top"
                    editable={!isSearching}
                />
                <CustomButton variant="primary" onPress={handleSearch} isLoading={isSearching} disabled={isSearching || query.trim().length === 0}>
                    Ask
                </CustomButton>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
                {result && (
                    <>
                        <View style={styles.answerCard}>
                            <Text style={styles.answerText}>{result.answer}</Text>
                            {modeLabel && <Text style={styles.modeLabel}>{modeLabel}</Text>}
                        </View>
                        {result.citations.length > 0 && <Text style={styles.sectionLabel}>Sources</Text>}
                        {result.citations.map((r) => (
                            <View key={r.id} style={styles.resultCard}>
                                <Text style={styles.resultHeading}>{r.heading}</Text>
                                <Text style={styles.resultMeta}>
                                    {r.source} · similarity {(r.score * 100).toFixed(0)}%
                                </Text>
                                <Text style={styles.resultText}>{r.text}</Text>
                            </View>
                        ))}
                    </>
                )}
                {searched && !isSearching && !result && <Text style={styles.emptyText}>No matching documentation found.</Text>}
            </ScrollView>
        </View>
    )
}

export default Chat
