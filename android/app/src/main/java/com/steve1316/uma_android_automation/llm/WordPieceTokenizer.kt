package com.steve1316.uma_android_automation.llm

import java.io.BufferedReader
import java.io.InputStreamReader
import java.text.Normalizer

/**
 * Minimal BERT-style WordPiece tokenizer for MiniLM-L6-v2 and other uncased BERT derivatives.
 *
 * Implements the uncased basic tokenization + WordPiece greedy-longest-match-first algorithm described in
 * Devlin et al. 2018. Output ids are compatible with the `sentence-transformers/all-MiniLM-L6-v2` ONNX model's
 * `input_ids` tensor.
 *
 * Not a general-purpose tokenizer: only supports the subset of BERT's behavior needed for embedding short
 * English queries and document chunks - lowercase, strip accents, split on whitespace + punctuation, no
 * basic-tokenizer cjk handling, no [UNK] bookkeeping beyond id 100.
 *
 * @property vocab Map from wordpiece string (including ``##`` continuations) to vocabulary id.
 */
class WordPieceTokenizer(private val vocab: Map<String, Int>) {
    companion object {
        /** Vocabulary id of the BERT `[CLS]` classification token prepended to every input. */
        const val CLS_ID = 101

        /** Vocabulary id of the BERT `[SEP]` separator token appended to every input. */
        const val SEP_ID = 102

        /** Vocabulary id used to right-pad sequences out to [MAX_SEQ_LEN]. */
        const val PAD_ID = 0

        /** Vocabulary id of the `[UNK]` token emitted for any wordpiece not found in [vocab]. */
        const val UNK_ID = 100

        /** Max sequence length matching sentence-transformers/all-MiniLM-L6-v2 default. */
        const val MAX_SEQ_LEN = 128

        /** Max characters per input word before emitting [UNK] (matches BERT's reference implementation). */
        private const val MAX_INPUT_CHARS_PER_WORD = 100

        /**
         * Load a tokenizer from a BERT-style vocab.txt where each line is one wordpiece in id order
         * (line 0 -> id 0, line 1 -> id 1, ...).
         *
         * @param stream Input stream over the vocab.txt resource.
         * @return A [WordPieceTokenizer] configured with the parsed vocabulary.
         */
        fun fromVocabStream(stream: java.io.InputStream): WordPieceTokenizer {
            val vocab = HashMap<String, Int>()
            BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).useLines { lines ->
                lines.forEachIndexed { index, line -> vocab[line.trim()] = index }
            }
            return WordPieceTokenizer(vocab)
        }
    }

    /**
     * Result of tokenizing a single piece of text for ONNX inference.
     *
     * @property inputIds Padded vocabulary ids of length [seqLen].
     * @property attentionMask 1 for real tokens, 0 for [PAD] padding, length [seqLen].
     * @property tokenTypeIds All zeros (single-segment input), length [seqLen].
     * @property seqLen Padded sequence length (bounded by [MAX_SEQ_LEN]).
     */
    data class Encoded(
        val inputIds: LongArray,
        val attentionMask: LongArray,
        val tokenTypeIds: LongArray,
        val seqLen: Int,
    )

    /**
     * Encode [text] into ONNX-ready tensors with `[CLS] ... [SEP]` framing and zero padding.
     *
     * @param text The input string.
     * @param maxLen Cap sequence length (≤ [MAX_SEQ_LEN]).
     * @return Encoded input tensors suitable for an `input_ids` + `attention_mask` BERT-family ONNX model.
     */
    fun encode(text: String, maxLen: Int = MAX_SEQ_LEN): Encoded {
        val cappedMax = maxLen.coerceAtMost(MAX_SEQ_LEN)
        val ids = ArrayList<Long>(cappedMax)
        ids.add(CLS_ID.toLong())

        val pieces = tokenize(text)
        for (piece in pieces) {
            // Reserve one slot for the trailing [SEP].
            if (ids.size >= cappedMax - 1) break
            ids.add((vocab[piece] ?: UNK_ID).toLong())
        }
        ids.add(SEP_ID.toLong())

        // Right-pad all three tensors out to [cappedMax] so the ONNX model gets fixed-shape inputs.
        // The mask marks which positions hold real tokens (1) vs PAD (0); pooling later uses this to ignore PAD rows.
        // token_type_ids stays all zeros because MiniLM only ever sees single-segment input.
        val real = ids.size
        val padded = LongArray(cappedMax) { if (it < real) ids[it] else PAD_ID.toLong() }
        val mask = LongArray(cappedMax) { if (it < real) 1L else 0L }
        val types = LongArray(cappedMax) { 0L }
        return Encoded(padded, mask, types, cappedMax)
    }

    /**
     * Tokenize [text] into an ordered list of wordpieces (no special tokens, no ids).
     *
     * Exposed for testing against HuggingFace reference output.
     *
     * @param text The raw input string.
     * @return Ordered list of wordpiece strings.
     */
    fun tokenize(text: String): List<String> {
        val basic = basicTokenize(text)
        val out = ArrayList<String>(basic.size)
        for (word in basic) out.addAll(wordPieceTokenize(word))
        return out
    }

    /**
     * BERT's basic tokenization pass: lowercase, strip accents, then split on whitespace and punctuation.
     *
     * Punctuation characters are emitted as standalone tokens (so `"don't"` becomes `["don", "'", "t"]`),
     * matching the reference implementation. The output is the input to [wordPieceTokenize], which then
     * subword-splits each whitespace/punct-bounded token against the vocab.
     *
     * @param text The raw input string.
     * @return Whitespace- and punctuation-separated tokens in source order; never contains whitespace tokens.
     */
    private fun basicTokenize(text: String): List<String> {
        val normalized = stripAccents(text.lowercase())
        val tokens = ArrayList<String>()
        val current = StringBuilder()
        for (ch in normalized) {
            when {
                ch.isWhitespace() -> {
                    if (current.isNotEmpty()) {
                        tokens.add(current.toString())
                        current.clear()
                    }
                }
                isPunctuation(ch) -> {
                    if (current.isNotEmpty()) {
                        tokens.add(current.toString())
                        current.clear()
                    }
                    tokens.add(ch.toString())
                }
                else -> current.append(ch)
            }
        }
        if (current.isNotEmpty()) tokens.add(current.toString())
        return tokens
    }

    /**
     * Greedy longest-match-first WordPiece subword split over a single [word].
     *
     * Walks a `start` cursor across the word; on each iteration shrinks an `end` cursor from the right until
     * the substring `word[start, end)` is a vocab entry, then advances `start` to `end`. Continuation pieces
     * (anything past the first) are looked up with the BERT `##` prefix. If no prefix of the remaining suffix
     * matches the vocab, the entire word collapses to a single `[UNK]` rather than emitting partial pieces -
     * this mirrors the BERT reference and keeps embedding behavior consistent with the indexer.
     *
     * Words longer than [MAX_INPUT_CHARS_PER_WORD] short-circuit straight to `[UNK]` so we don't waste time
     * scanning a giant span that almost certainly isn't a real word.
     *
     * @param word A single whitespace- and punctuation-bounded token from [basicTokenize].
     * @return Ordered wordpiece strings (with `##` continuations), or `["[UNK]"]` if [word] is unrepresentable.
     */
    private fun wordPieceTokenize(word: String): List<String> {
        // Per BERT's reference impl, words past this length aren't worth attempting to subword-split: emit a
        // single [UNK] for the whole word rather than wasting time scanning a giant span.
        if (word.length > MAX_INPUT_CHARS_PER_WORD) return listOf("[UNK]")

        val chars = word.toCharArray()
        val pieces = ArrayList<String>()
        var start = 0

        // Outer loop walks the start cursor across the word. Each iteration consumes one wordpiece by finding
        // the longest [start, end) substring that exists in [vocab]; the next iteration begins at that [end].
        while (start < chars.size) {
            var end = chars.size
            var matched: String? = null

            // Inner loop shrinks [end] from the right until a vocab match is found - this is what makes the algorithm "longest-match-first".
            // Continuation pieces (start > 0) get the BERT "##" prefix.
            while (start < end) {
                val substr =
                    buildString {
                        if (start > 0) append("##")
                        for (i in start until end) append(chars[i])
                    }
                if (vocab.containsKey(substr)) {
                    matched = substr
                    break
                }
                end -= 1
            }

            // If no prefix of the remaining suffix matched, the whole word is unrepresentable.
            // Per the BERT reference, fall back to a single [UNK] for the entire word rather than emitting partial pieces.
            if (matched == null) return listOf("[UNK]")
            pieces.add(matched)
            start = end
        }
        return pieces
    }

    /**
     * Drop combining marks via NFD normalization; equivalent to BERT's strip-accents pass.
     *
     * Decomposes each character into its base letter plus combining marks (NFD), then keeps only non-combining
     * codepoints. The net effect: `"café"` becomes `"cafe"`, `"naïve"` becomes `"naive"`. This matches the
     * uncased MiniLM vocab, which contains only un-accented Latin tokens.
     *
     * @param text Already-lowercased input.
     * @return [text] with all combining accent marks removed.
     */
    private fun stripAccents(text: String): String {
        val nfd = Normalizer.normalize(text, Normalizer.Form.NFD)
        val sb = StringBuilder(nfd.length)
        for (ch in nfd) if (Character.getType(ch).toByte() != Character.NON_SPACING_MARK) sb.append(ch)
        return sb.toString()
    }

    /**
     * Mirror BERT's `_is_punctuation`: any ASCII punct codepoint plus any character in a Unicode P* category.
     *
     * The four ASCII ranges (`!`-`/`, `:`-`@`, `[`-`` ` ``, `{`-`~`) cover characters Java's
     * [Character.getType] does not classify as punctuation (e.g. `$`, `+`, `<`); explicitly listing them keeps
     * tokenization byte-identical to the Python reference. The Unicode fallback catches non-ASCII punctuation
     * that may appear in copy-pasted query text.
     *
     * @param ch The character to classify.
     * @return true if [ch] should split a token in [basicTokenize].
     */
    private fun isPunctuation(ch: Char): Boolean {
        val cp = ch.code
        if (cp in 33..47 || cp in 58..64 || cp in 91..96 || cp in 123..126) return true
        val type = Character.getType(ch)
        return type in Character.DASH_PUNCTUATION..Character.OTHER_PUNCTUATION
    }
}
