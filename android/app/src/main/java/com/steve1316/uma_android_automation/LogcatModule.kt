package com.steve1316.uma_android_automation

import android.util.Log
import androidx.documentfile.provider.DocumentFile
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.steve1316.automation_library.utils.UserStorageManager
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Bridge module that dumps this app's own logcat output to a text file at the root of the user's storage folder. On modern Android an unprivileged app only
 * sees its own process logs, which is exactly the bot's debug output, errors, and crashes.
 *
 * @param reactContext The React Native application context.
 */
class LogcatModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    companion object {
        private val TAG = "[${MainActivity.loggerTag}]LogcatModule"

        // The dump covers the last 6 hours, bounded by the actual logcat ring-buffer capacity.
        private const val WINDOW_MILLIS = 6L * 60L * 60L * 1000L
    }

    private val appContext: ReactApplicationContext = reactContext

    override fun getName(): String {
        return "LogcatModule"
    }

    /** Dump the app's logcat from the last 6 hours into `adb_dump_<timestamp>.txt` at the storage root. Resolves with
     * `{filename, bytes, location}`, or rejects with `DUMP_FAILED` when no writable location exists or logcat fails.
     *
     * @param promise Resolved with the dump result map, or rejected on failure.
     */
    @ReactMethod
    fun dumpLogcat(promise: Promise) {
        try {
            val now = Date()
            val filename = "adb_dump_${SimpleDateFormat("yyyy-MM-dd_HH_mm_ss", Locale.US).format(now)}.txt"
            val since = SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US).format(Date(now.time - WINDOW_MILLIS))

            val target = openDumpTarget(filename)
            if (target == null) {
                promise.reject("DUMP_FAILED", "No writable storage location is available for the logcat dump.")
                return
            }
            val (out, location) = target

            val bytes =
                out.use { stream ->
                    val process = Runtime.getRuntime().exec(arrayOf("logcat", "-d", "-v", "threadtime", "-t", since))
                    try {
                        process.inputStream.use { input -> input.copyTo(stream) }
                    } finally {
                        process.errorStream.close()
                        process.waitFor()
                    }
                }

            val map: WritableMap = Arguments.createMap()
            map.putString("filename", filename)
            map.putDouble("bytes", bytes.toDouble())
            map.putString("location", location)
            promise.resolve(map)
        } catch (e: Exception) {
            Log.e(TAG, "dumpLogcat failed", e)
            promise.reject("DUMP_FAILED", e.message ?: e.toString(), e)
        }
    }

    /** Open a writable stream for the dump file at the root of the configured SAF folder, falling back to the root of the legacy external-files directory when no folder is
     * configured. Returns the stream paired with a short location label (the folder name for SAF, or the absolute path for legacy), or null when nothing writable exists.
     * The label is derived locally rather than via `UserStorageManager.pathLabel()` so the module only depends on `getInstance` / `getTreeUri`.
     *
     * @param filename The dump file name to create at the root.
     *
     * @return The output stream and a location label, or null.
     */
    private fun openDumpTarget(filename: String): Pair<OutputStream, String>? {
        val treeUri = UserStorageManager.getInstance(appContext).getTreeUri()
        if (treeUri != null) {
            val tree = DocumentFile.fromTreeUri(appContext, treeUri)
            if (tree != null && tree.canWrite()) {
                tree.findFile(filename)?.delete()
                val file = tree.createFile("text/plain", filename)
                if (file != null) {
                    val stream = appContext.contentResolver.openOutputStream(file.uri)
                    if (stream != null) return Pair(stream, tree.name ?: "your storage folder")
                    file.delete()
                }
            }
        }
        val root = appContext.getExternalFilesDir(null) ?: appContext.filesDir ?: return null
        return Pair(FileOutputStream(File(root, filename)), root.absolutePath)
    }
}
