package com.steve1316.uma_android_automation.llm

import android.app.DownloadManager
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.util.Log
import com.steve1316.automation_library.data.SharedData
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.io.File

/**
 * Fetches the generative model file (e.g. Gemma 3 1B `.task` ~529 MB) from a remote URL into app-private storage
 * using Android [DownloadManager], so the APK stays lean and the download shows up in the system notification
 * shade with cancel and pause support.
 *
 * Downloads land at [modelFile] under `context.getExternalFilesDir("llm")`, which is app-private — no storage
 * permission required. Delete via [delete] when the user wants to reclaim space.
 *
 * @property context Application context.
 */
class ModelDownloader(private val context: Context) {
    private val dm: DownloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

    companion object {
        private const val TAG = "${SharedData.loggerTag}ModelDownloader"
        private const val LLM_DIR = "llm"
        const val DEFAULT_MODEL_FILENAME = "gemma-3-1b-it.task"
        private const val POLL_INTERVAL_MS = 500L
    }

    /**
     * Absolute on-device path where [DEFAULT_MODEL_FILENAME] will land after a successful download.
     *
     * Uses app-private external storage (`getExternalFilesDir`) rather than `filesDir` because DownloadManager
     * cannot write to app-private internal storage ("Unsupported path" error). External-files dir is still
     * app-scoped — no permission required and auto-deleted on uninstall — just a different filesystem.
     */
    val modelFile: File by lazy {
        val base = context.getExternalFilesDir(LLM_DIR) ?: File(context.filesDir, LLM_DIR).also { it.mkdirs() }
        File(base, DEFAULT_MODEL_FILENAME)
    }

    /** @return true if a model file is already present on-device and non-empty. */
    fun isDownloaded(): Boolean = modelFile.isFile && modelFile.length() > 0

    /**
     * One state emission from [download]. Consumers switch UI between indeterminate / progress / error / complete.
     *
     * @property bytesDownloaded Bytes received so far. Zero for [Failed] emissions.
     * @property bytesTotal Total expected bytes, or -1 when the server did not advertise Content-Length.
     * @property status One of the [DownloadManager.STATUS_*] constants. [Failed] remaps unknown codes to STATUS_FAILED.
     * @property failureReason DownloadManager reason code for [Failed] only; null otherwise.
     */
    sealed class State {
        object Pending : State()
        data class Running(val bytesDownloaded: Long, val bytesTotal: Long) : State()
        data class Paused(val bytesDownloaded: Long, val bytesTotal: Long) : State()
        data class Failed(val failureReason: Int) : State()
        object Complete : State()
    }

    /**
     * Start downloading [url] into [modelFile], replacing any existing file. Emits [State]s until the download
     * succeeds, fails, or is cancelled. Cancelling the consuming coroutine cancels the underlying DownloadManager
     * request.
     *
     * @param url HTTPS URL of the model file.
     * @return Cold [Flow] that begins the download when collected.
     */
    fun download(url: String, authToken: String? = null): Flow<State> = flow {
        if (modelFile.exists()) modelFile.delete()
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle("Uma Chat Model")
            .setDescription("Downloading the on-device chatbot model (~530 MB).")
            .setDestinationUri(Uri.fromFile(modelFile))
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setAllowedOverMetered(false)
        if (!authToken.isNullOrBlank()) request.addRequestHeader("Authorization", "Bearer ${authToken.trim()}")
        val id = dm.enqueue(request)
        Log.i(TAG, "download:: enqueued id=$id url=$url")
        emit(State.Pending)

        try {
            while (true) {
                val snapshot = query(id)
                if (snapshot == null) {
                    emit(State.Failed(DownloadManager.ERROR_UNKNOWN))
                    return@flow
                }
                emit(snapshot)
                if (snapshot is State.Complete || snapshot is State.Failed) return@flow
                delay(POLL_INTERVAL_MS)
            }
        } finally {
            // Leave the file in place on success; DownloadManager auto-cleans temp files on failure. If the
            // consumer cancels mid-flight we remove the partial record so the notification disappears.
            val latest = query(id)
            if (latest !is State.Complete && latest !is State.Failed) dm.remove(id)
        }
    }

    /** Remove the downloaded model from disk. @return true if a file was deleted. */
    fun delete(): Boolean = if (modelFile.isFile) modelFile.delete() else false

    /** @return Current size in bytes of the downloaded model, or 0 if not present. */
    fun size(): Long = if (modelFile.isFile) modelFile.length() else 0

    private fun query(id: Long): State? {
        val q = DownloadManager.Query().setFilterById(id)
        dm.query(q).use { cursor: Cursor ->
            if (!cursor.moveToFirst()) return null
            val statusIdx = cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)
            val soFarIdx = cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
            val totalIdx = cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
            val reasonIdx = cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)
            val status = cursor.getInt(statusIdx)
            val soFar = cursor.getLong(soFarIdx)
            val total = cursor.getLong(totalIdx)
            return when (status) {
                DownloadManager.STATUS_PENDING -> State.Pending
                DownloadManager.STATUS_RUNNING -> State.Running(soFar, total)
                DownloadManager.STATUS_PAUSED -> State.Paused(soFar, total)
                DownloadManager.STATUS_SUCCESSFUL -> State.Complete
                DownloadManager.STATUS_FAILED -> State.Failed(cursor.getInt(reasonIdx))
                else -> State.Failed(DownloadManager.ERROR_UNKNOWN)
            }
        }
    }
}
