package com.steve1316.uma_android_automation.llm

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.steve1316.automation_library.data.SharedData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

/**
 * React Native bridge exposing the on-device documentation chatbot to the JS frontend.
 *
 * @property reactContext Injected by React Native's module loader.
 */
class LLMChatModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val orchestrator = ChatOrchestrator(reactContext.applicationContext)
    private val scope = CoroutineScope(Dispatchers.Default)

    @Volatile private var downloadJob: Job? = null

    companion object {
        private const val TAG = "${SharedData.loggerTag}LLMChatModule"
        private const val MODULE_NAME = "LLMChatModule"

        /** Event emitted per DownloadManager progress snapshot. Payload: `{ status, bytesDownloaded, bytesTotal }`. */
        const val EVENT_DOWNLOAD_STATE = "LLMChatModule.DownloadState"
    }

    override fun getName(): String = MODULE_NAME

    /**
     * Retrieve-only search. See [ChatOrchestrator.searchDocs].
     *
     * @param query User question.
     * @param k Maximum chunks to return.
     * @param promise Resolved with `[{ id, source, heading, text, score }]`.
     */
    @ReactMethod
    fun searchDocs(query: String, k: Int, promise: Promise) {
        scope.launch {
            try {
                val results = orchestrator.searchDocs(query, k)
                promise.resolve(resultsToArray(results))
            } catch (e: Exception) {
                Log.e(TAG, "searchDocs:: failed: ${e.message}", e)
                promise.reject("E_SEARCH_FAILED", e.message, e)
            }
        }
    }

    /**
     * Full RAG chat. Resolves with `{ answer, mode, service, overlap, citations, rejectedAnswer? }`.
     * `mode` is one of `"generated"`, `"retrieveOnly"`, `"verifierFallback"`.
     *
     * @param query User question.
     * @param k Maximum chunks to use as context.
     * @param promise Resolved with the chat result.
     */
    @ReactMethod
    fun chat(query: String, k: Int, promise: Promise) {
        scope.launch {
            try {
                val result = orchestrator.chat(query, k)
                val map = Arguments.createMap()
                map.putString("answer", result.answer)
                map.putArray("citations", resultsToArray(result.citations))
                when (val mode = result.mode) {
                    is ChatOrchestrator.ChatMode.RetrieveOnly -> {
                        map.putString("mode", "retrieveOnly")
                    }
                    is ChatOrchestrator.ChatMode.Generated -> {
                        map.putString("mode", "generated")
                        map.putString("service", mode.service)
                        map.putDouble("overlap", mode.overlap.toDouble())
                    }
                    is ChatOrchestrator.ChatMode.VerifierFallback -> {
                        map.putString("mode", "verifierFallback")
                        map.putString("service", mode.service)
                        map.putDouble("overlap", mode.overlap.toDouble())
                        map.putString("rejectedAnswer", mode.rejectedAnswer)
                    }
                }
                promise.resolve(map)
            } catch (e: Exception) {
                Log.e(TAG, "chat:: failed: ${e.message}", e)
                promise.reject("E_CHAT_FAILED", e.message, e)
            }
        }
    }

    /** Resolves with `{ nanoStatus, mediaPipeDownloaded, mediaPipeSizeBytes, activeService }`. */
    @ReactMethod
    fun getServiceStatus(promise: Promise) {
        scope.launch {
            try {
                val s = orchestrator.getServiceStatus()
                val map = Arguments.createMap()
                map.putInt("nanoStatus", s.nanoStatus)
                map.putBoolean("mediaPipeDownloaded", s.mediaPipeDownloaded)
                map.putDouble("mediaPipeSizeBytes", s.mediaPipeSizeBytes.toDouble())
                map.putString("activeService", s.activeService)
                promise.resolve(map)
            } catch (e: Exception) {
                Log.e(TAG, "getServiceStatus:: failed: ${e.message}", e)
                promise.reject("E_STATUS_FAILED", e.message, e)
            }
        }
    }

    /**
     * Toggle whether the orchestrator prefers Gemini Nano over MediaPipe when both are available.
     */
    @ReactMethod
    fun setPreferNano(prefer: Boolean) {
        orchestrator.preferNano = prefer
    }

    /**
     * Start downloading the generative model from [url]. Progress is emitted via [EVENT_DOWNLOAD_STATE].
     * Resolves immediately once the download has been enqueued.
     */
    @ReactMethod
    fun downloadModel(url: String, authToken: String?, promise: Promise) {
        val existing = downloadJob
        if (existing != null && existing.isActive) {
            promise.reject("E_ALREADY_DOWNLOADING", "A model download is already in progress.")
            return
        }
        downloadJob = scope.launch {
            try {
                orchestrator.modelDownloader().download(url, authToken).collect { state ->
                    emitDownloadState(state)
                }
            } catch (e: Exception) {
                Log.e(TAG, "downloadModel:: failed: ${e.message}", e)
                emitDownloadStateRaw("error", 0, 0, e.message)
            }
        }
        promise.resolve(null)
    }

    /** Cancel the in-progress download, if any. */
    @ReactMethod
    fun cancelDownload(promise: Promise) {
        downloadJob?.cancel()
        downloadJob = null
        promise.resolve(null)
    }

    /** Delete the downloaded model from disk. */
    @ReactMethod
    fun deleteModel(promise: Promise) {
        val deleted = orchestrator.modelDownloader().delete()
        promise.resolve(deleted)
    }

    // --------------------------------------------------------------------------------------------------

    private fun resultsToArray(results: List<DocIndex.Result>) = Arguments.createArray().also { array ->
        for (r in results) {
            val map = Arguments.createMap()
            map.putString("id", r.chunk.id)
            map.putString("source", r.chunk.source)
            map.putString("heading", r.chunk.heading)
            map.putString("text", r.chunk.text)
            map.putDouble("score", r.score.toDouble())
            array.pushMap(map)
        }
    }

    private fun emitDownloadState(state: ModelDownloader.State) {
        when (state) {
            is ModelDownloader.State.Pending -> emitDownloadStateRaw("pending", 0, 0, null)
            is ModelDownloader.State.Running -> emitDownloadStateRaw("running", state.bytesDownloaded, state.bytesTotal, null)
            is ModelDownloader.State.Paused -> emitDownloadStateRaw("paused", state.bytesDownloaded, state.bytesTotal, null)
            is ModelDownloader.State.Complete -> emitDownloadStateRaw("complete", 0, 0, null)
            is ModelDownloader.State.Failed -> emitDownloadStateRaw("failed", 0, 0, "reason=${state.failureReason}")
        }
    }

    private fun emitDownloadStateRaw(status: String, soFar: Long, total: Long, error: String?) {
        val map: WritableMap = Arguments.createMap()
        map.putString("status", status)
        map.putDouble("bytesDownloaded", soFar.toDouble())
        map.putDouble("bytesTotal", total.toDouble())
        if (error != null) map.putString("error", error)
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(EVENT_DOWNLOAD_STATE, map)
    }
}
