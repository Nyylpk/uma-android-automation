package com.steve1316.uma_android_automation.llm

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.util.Log
import com.steve1316.automation_library.data.SharedData
import java.nio.LongBuffer
import kotlin.math.sqrt

/**
 * Produces fixed-size sentence embeddings from text using MiniLM-L6-v2 (int8 quantized) via ONNX Runtime.
 *
 * Embeddings are 384-dimensional, mean-pooled over non-PAD token positions and L2-normalized — matching the reference
 * output of the `sentence-transformers/all-MiniLM-L6-v2` Python model so vectors produced here are directly comparable
 * via cosine similarity with vectors produced by the build-time indexer.
 *
 * Reuses the existing [ai.onnxruntime] dependency already bundled for YOLOv8 detection.
 *
 * @property context The application context for loading the model and vocab from assets.
 */
class EmbeddingService(private val context: Context) {
    private val ortEnv: OrtEnvironment = OrtEnvironment.getEnvironment()
    private var session: OrtSession? = null
    private lateinit var tokenizer: WordPieceTokenizer

    companion object {
        private const val TAG = "${SharedData.loggerTag}EmbeddingService"
        private const val MODEL_PATH = "llm/minilm-l6-v2-int8.onnx"
        private const val VOCAB_PATH = "llm/minilm-l6-v2-vocab.txt"

        /** Output embedding dimensionality — fixed by the MiniLM-L6-v2 architecture. */
        const val EMBEDDING_DIM = 384
    }

    init {
        load()
    }

    /**
     * Embed [text] into a length-[EMBEDDING_DIM] unit vector.
     *
     * @param text The query or document chunk to embed.
     * @return A normalized float array of length [EMBEDDING_DIM], or null if the model is not loaded.
     */
    fun embed(text: String): FloatArray? {
        val s = session ?: run {
            Log.w(TAG, "embed:: session not initialized; returning null")
            return null
        }
        val encoded = tokenizer.encode(text)
        val shape = longArrayOf(1, encoded.seqLen.toLong())

        OnnxTensor.createTensor(ortEnv, LongBuffer.wrap(encoded.inputIds), shape).use { ids ->
            OnnxTensor.createTensor(ortEnv, LongBuffer.wrap(encoded.attentionMask), shape).use { mask ->
                OnnxTensor.createTensor(ortEnv, LongBuffer.wrap(encoded.tokenTypeIds), shape).use { types ->
                    val inputs = mapOf(
                        "input_ids" to ids,
                        "attention_mask" to mask,
                        "token_type_ids" to types,
                    )
                    s.run(inputs).use { result ->
                        @Suppress("UNCHECKED_CAST")
                        val hidden = result[0].value as Array<Array<FloatArray>>
                        return meanPoolAndNormalize(hidden[0], encoded.attentionMask)
                    }
                }
            }
        }
    }

    /**
     * Mean-pool the token embeddings over positions where attention_mask == 1, then L2-normalize.
     *
     * @param hidden `[seq_len][embedding_dim]` matrix of per-token hidden states.
     * @param mask Attention mask aligned to [hidden]'s first dimension.
     * @return Pooled and L2-normalized embedding of length [EMBEDDING_DIM].
     */
    private fun meanPoolAndNormalize(hidden: Array<FloatArray>, mask: LongArray): FloatArray {
        val pooled = FloatArray(EMBEDDING_DIM)
        var count = 0
        for (t in hidden.indices) {
            if (mask[t] == 0L) continue
            val row = hidden[t]
            for (d in 0 until EMBEDDING_DIM) pooled[d] += row[d]
            count += 1
        }
        if (count > 0) for (d in 0 until EMBEDDING_DIM) pooled[d] /= count.toFloat()

        var norm = 0f
        for (d in 0 until EMBEDDING_DIM) norm += pooled[d] * pooled[d]
        norm = sqrt(norm)
        if (norm > 0f) for (d in 0 until EMBEDDING_DIM) pooled[d] /= norm
        return pooled
    }

    private fun load() {
        try {
            val modelBytes = context.assets.open(MODEL_PATH).readBytes()
            session = ortEnv.createSession(modelBytes)
            tokenizer = context.assets.open(VOCAB_PATH).use { WordPieceTokenizer.fromVocabStream(it) }
            Log.i(TAG, "load:: MiniLM model and vocab loaded (${modelBytes.size / 1024} KB model)")
        } catch (e: Exception) {
            Log.e(TAG, "load:: failed to initialize: ${e.message}", e)
        }
    }

    /** Release the ONNX session. Call from the owning component's teardown. */
    fun close() {
        session?.close()
        session = null
    }
}
