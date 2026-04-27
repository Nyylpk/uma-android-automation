package com.steve1316.uma_android_automation.llm

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/**
 * Unit tests for [WordPieceTokenizer] against the `bert-base-uncased` / `all-MiniLM-L6-v2` shared vocabulary.
 *
 * Expected ids are the reference output of HuggingFace `BertTokenizerFast("bert-base-uncased")` on the same inputs -
 * keeping Kotlin output in lockstep with it is what guarantees the ONNX model receives the exact tensors it was
 * trained on.
 */
@DisplayName("WordPieceTokenizer Tests")
class WordPieceTokenizerTest {
    private val tokenizer: WordPieceTokenizer =
        java.io.File("src/main/assets/llm/minilm-l6-v2-vocab.txt")
            .inputStream()
            .use { WordPieceTokenizer.fromVocabStream(it) }

    @Test
    @DisplayName("encodes 'hello world' with correct framing and ids")
    fun encodesHelloWorld() {
        val encoded = tokenizer.encode("hello world")
        assertEquals(WordPieceTokenizer.MAX_SEQ_LEN, encoded.seqLen)
        assertEquals(WordPieceTokenizer.CLS_ID.toLong(), encoded.inputIds[0])
        assertEquals(7592L, encoded.inputIds[1], "hello -> 7592")
        assertEquals(2088L, encoded.inputIds[2], "world -> 2088")
        assertEquals(WordPieceTokenizer.SEP_ID.toLong(), encoded.inputIds[3])
        assertEquals(WordPieceTokenizer.PAD_ID.toLong(), encoded.inputIds[4], "pad after [SEP]")
        assertEquals(1L, encoded.attentionMask[0])
        assertEquals(0L, encoded.attentionMask[4])
    }

    @Test
    @DisplayName("lowercases and splits punctuation")
    fun lowercasesAndSplitsPunctuation() {
        val pieces = tokenizer.tokenize("Hello, World!")
        assertEquals(listOf("hello", ",", "world", "!"), pieces)
    }

    @Test
    @DisplayName("applies WordPiece ## continuation to OOV tokens")
    fun wordpieceContinuation() {
        // "unaffordable" is not in vocab; expected split is "una" + "##ff" + "##ord" + "##able" (or similar).
        val pieces = tokenizer.tokenize("unaffordable")
        assertTrue(pieces.size > 1, "OOV word should split into multiple wordpieces")
        assertTrue(pieces.drop(1).all { it.startsWith("##") }, "continuation pieces must be ##-prefixed")
    }

    @Test
    @DisplayName("strips accents (NFD + drop combining marks)")
    fun stripsAccents() {
        val pieces = tokenizer.tokenize("café")
        assertEquals("cafe", pieces.joinToString("").replace("##", ""))
    }

    @Test
    @DisplayName("truncates to maxLen while preserving [CLS] and [SEP]")
    fun truncatesToMaxLen() {
        val longText = "hello ".repeat(200)
        val encoded = tokenizer.encode(longText, maxLen = 16)
        assertEquals(16, encoded.seqLen)
        assertEquals(WordPieceTokenizer.CLS_ID.toLong(), encoded.inputIds[0])
        assertEquals(WordPieceTokenizer.SEP_ID.toLong(), encoded.inputIds[15])
    }
}
