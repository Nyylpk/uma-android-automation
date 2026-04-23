package com.steve1316.uma_android_automation.llm

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.steve1316.automation_library.data.SharedData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * React Native bridge exposing the on-device documentation chatbot to the JS frontend.
 *
 * Current surface is retrieve-only: [searchDocs] returns the top-k matching doc chunks with their source file,
 * heading, text, and cosine score. Generation methods will be added once [ChatOrchestrator] grows the LLM path.
 *
 * @property reactContext Injected by React Native's module loader.
 */
class LLMChatModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val orchestrator = ChatOrchestrator(reactContext.applicationContext)
    private val scope = CoroutineScope(Dispatchers.Default)

    companion object {
        private const val TAG = "${SharedData.loggerTag}LLMChatModule"
        private const val MODULE_NAME = "LLMChatModule"
    }

    override fun getName(): String = MODULE_NAME

    /**
     * Retrieve the top-[k] doc chunks matching [query].
     *
     * Resolves with a WritableArray of WritableMaps: `{ id, source, heading, text, score }` ordered by descending
     * score. Empty array if the query embedding fails (model load error, unsupported device) — treat the empty case
     * as "no documentation match found" at the UI layer.
     *
     * @param query User-typed natural-language question.
     * @param k Maximum number of chunks to return.
     * @param promise React Native promise to resolve with the results array or reject with the error.
     */
    @ReactMethod
    fun searchDocs(query: String, k: Int, promise: Promise) {
        scope.launch {
            try {
                val results = orchestrator.searchDocs(query, k)
                val array = Arguments.createArray()
                for (r in results) {
                    val map = Arguments.createMap()
                    map.putString("id", r.chunk.id)
                    map.putString("source", r.chunk.source)
                    map.putString("heading", r.chunk.heading)
                    map.putString("text", r.chunk.text)
                    map.putDouble("score", r.score.toDouble())
                    array.pushMap(map)
                }
                promise.resolve(array)
            } catch (e: Exception) {
                Log.e(TAG, "searchDocs:: failed: ${e.message}", e)
                promise.reject("E_SEARCH_FAILED", e.message, e)
            }
        }
    }
}
