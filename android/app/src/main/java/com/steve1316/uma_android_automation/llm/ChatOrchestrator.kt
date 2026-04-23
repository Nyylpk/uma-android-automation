package com.steve1316.uma_android_automation.llm

import android.content.Context
import android.util.Log
import com.steve1316.automation_library.data.SharedData

/**
 * Top-level coordinator for the on-device documentation chatbot.
 *
 * In the current stage implements only the retrieve-only path — embed query, cosine-search the bundled doc index,
 * return the top-k chunks verbatim. Generation (MediaPipe / Gemini Nano) layers on later in the same class.
 *
 * Lazily initialized: both the ONNX embedder and the doc index load from assets on first [searchDocs] call.
 *
 * @property context Application context for asset access.
 */
class ChatOrchestrator(private val context: Context) {
    @Volatile private var embedder: EmbeddingService? = null
    @Volatile private var index: DocIndex? = null

    companion object {
        private const val TAG = "${SharedData.loggerTag}ChatOrchestrator"
        private const val INDEX_PATH = "llm/doc_index.bin"
    }

    /**
     * Run retrieval for [query] and return the top-[k] doc chunks.
     *
     * @param query User-typed natural-language question.
     * @param k Maximum number of chunks to return.
     * @return List of retrieval results ordered by descending cosine similarity, or an empty list if initialization
     *   failed or the query embedder returned null.
     */
    fun searchDocs(query: String, k: Int = 4): List<DocIndex.Result> {
        val emb = ensureEmbedder() ?: return emptyList()
        val idx = ensureIndex() ?: return emptyList()
        val vector = emb.embed(query) ?: return emptyList()
        return idx.search(vector, k)
    }

    private fun ensureEmbedder(): EmbeddingService? {
        embedder?.let { return it }
        synchronized(this) {
            embedder?.let { return it }
            val created = EmbeddingService(context)
            embedder = created
            return created
        }
    }

    private fun ensureIndex(): DocIndex? {
        index?.let { return it }
        synchronized(this) {
            index?.let { return it }
            try {
                context.assets.open(INDEX_PATH).use { stream ->
                    val loaded = DocIndex.load(stream)
                    Log.i(TAG, "ensureIndex:: loaded ${loaded.chunks.size} chunks, dim=${loaded.dim}")
                    index = loaded
                    return loaded
                }
            } catch (e: Exception) {
                Log.e(TAG, "ensureIndex:: failed to load $INDEX_PATH: ${e.message}", e)
                return null
            }
        }
    }

    /** Release held resources. Call from owning component teardown. */
    fun close() {
        embedder?.close()
        embedder = null
        index = null
    }
}
