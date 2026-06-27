package com.steve1316.uma_android_automation.llm

import android.util.Log
import com.steve1316.automation_library.data.SharedData
import java.io.DataInputStream
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * In-memory vector store backing the documentation chatbot's retrieval step.
 *
 * Loads a compact binary index produced at build time by the indexer script, holding all chunk metadata plus
 * 384-dim L2-normalized embeddings. At 500 chunks x 384 floats x 4 bytes this is ~750 KB of RAM - linear cosine
 * scan over the whole set is microseconds, no ANN datastructure needed at this scale.
 *
 * Binary format (little-endian):
 * ```
 * magic   : "UMADOCIX" (8 bytes)
 * version : u32        (currently 2)
 * count   : u32        number of chunks
 * dim     : u32        embedding dimensionality
 * chunks  : count x { idLen u16, id utf-8; sourceLen u16, source utf-8; headingLen u16, heading utf-8;
 *                     textLen u32, text utf-8; dim x f32 }
 * ```
 *
 * @property chunks Loaded chunk records with their embeddings.
 * @property dim Embedding dimensionality declared in the index header.
 */
class DocIndex(val chunks: List<Chunk>, val dim: Int) {
    /** Chunk source: documentation prose (markdown / searchConfig) or Kotlin source code. */
    enum class Kind { DOC, CODE }

    /**
     * A single retrievable record produced by the build-time indexer.
     *
     * One [Chunk] is what [search] scores and what [ChatOrchestrator.expandSection] later reassembles into a
     * full section for the LLM to ground on. The [embedding] is what the cosine search compares against; every
     * other field is metadata used either for display, citation, or section reassembly.
     *
     * @property id Stable identifier of the form `source#heading-{flush}-{seq}`
     *   (e.g. `how_it_works.md#energy-management-0`). The `flush` and `seq` suffixes are how
     *   [ChatOrchestrator.expandSection] groups and orders sliced chunks back into one section.
     * @property source Source file name (e.g. `HOW_IT_WORKS.md` or a Kotlin file path). Used for citation
     *   labels and to scope reassembly to a single source file.
     * @property heading Nearest enclosing markdown heading, formatted as a breadcrumb (`H1 > H2 > H3`). Used
     *   for display and for the heading-prefix match in [ChatOrchestrator.expandSection].
     * @property text Raw chunk text shown verbatim when this chunk is cited; also the input that produced
     *   [embedding]. May contain CHUNK_OVERLAP_WORDS leading words shared with the previous sibling chunk.
     * @property kind Whether this chunk is documentation prose ([Kind.DOC]) or Kotlin source code ([Kind.CODE]).
     *   Code chunks are self-contained at function/class granularity and skip the section-reassembly step.
     * @property embedding L2-normalized 384-dim float vector embedding of [text], directly comparable via dot
     *   product to a query embedding produced by [EmbeddingService].
     */
    data class Chunk(
        val id: String,
        val source: String,
        val heading: String,
        val text: String,
        val kind: Kind,
        val embedding: FloatArray,
    )

    /**
     * One retrieval result.
     *
     * @property chunk The matched chunk.
     * @property score Cosine similarity in [-1, 1] (both query and chunk embeddings are L2-normalized).
     */
    data class Result(val chunk: Chunk, val score: Float)

    /**
     * Return the top-[k] chunks by cosine similarity to [query].
     *
     * @param query L2-normalized query embedding; must be length [dim].
     * @param k Number of results to return.
     * @return Top-k results sorted by descending score.
     */
    fun search(query: FloatArray, k: Int = 4): List<Result> {
        require(query.size == dim) { "query dim ${query.size} != index dim $dim" }
        val scored = ArrayList<Result>(chunks.size)

        // Linear cosine scan. Both [query] and each [chunk.embedding] are L2-normalized at build time, so the
        // dot product equals cosine similarity directly - no per-chunk magnitude division needed.
        // The indexed local [emb] avoids re-resolving the field through the [Chunk] reference inside the hot inner loop.
        for (chunk in chunks) {
            var dot = 0f
            val emb = chunk.embedding
            for (i in 0 until dim) dot += query[i] * emb[i]
            scored.add(Result(chunk, dot))
        }

        scored.sortByDescending { it.score }
        return if (scored.size <= k) scored else scored.subList(0, k)
    }

    companion object {
        /** Logger tag for this class. */
        private const val TAG = "${SharedData.loggerTag}DocIndex"

        /** First 8 bytes of every index file; used to sanity-check the binary stream on [load]. */
        private const val MAGIC = "UMADOCIX"

        /** Index format version; bumped whenever the on-disk layout changes. */
        private const val VERSION = 2

        /** Sentinel byte tagging a chunk as documentation prose. */
        private const val KIND_DOC: Byte = 0x01

        /** Sentinel byte tagging a chunk as Kotlin source code. */
        private const val KIND_CODE: Byte = 0x02

        /**
         * Parse a [DocIndex] from a binary stream produced by the build-time indexer.
         *
         * @param stream Input stream positioned at the start of the index data. Consumed but not closed.
         * @return The populated index.
         * @throws IllegalStateException If the magic or version does not match.
         */
        fun load(stream: InputStream): DocIndex {
            val input = DataInputStream(stream)

            // Header: validate magic + version before trusting any of the size fields below. A wrong file shape
            // here would otherwise allocate gigabyte-sized buffers from garbage length prefixes.
            val magic = ByteArray(8).also { input.readFully(it) }
            check(String(magic, Charsets.UTF_8) == MAGIC) { "bad magic: ${String(magic, Charsets.UTF_8)}" }

            val version = readU32LE(input)
            check(version == VERSION) { "unsupported index version $version" }
            val count = readU32LE(input)
            val dim = readU32LE(input)
            Log.d(TAG, "load:: $count chunks, dim=$dim")

            val chunks = ArrayList<Chunk>(count)
            for (i in 0 until count) {
                // Per-chunk record: each variable-length string is preceded by its byte length. id/source/heading
                // use u16 (≤ 65535 bytes is plenty for filenames and breadcrumbs); text uses u32 to cover larger
                // prose chunks. Defaulting unknown kind bytes to DOC keeps older indexers forward-compatible.
                val id = readString(input, readU16LE(input))
                val source = readString(input, readU16LE(input))
                val heading = readString(input, readU16LE(input))
                val text = readString(input, readU32LE(input))
                val kindByte = input.readByte()
                val kind = if (kindByte == KIND_CODE) Kind.CODE else Kind.DOC

                // Embedding bytes are read in one go and decoded via a wrapping ByteBuffer; per-float reads via
                // DataInputStream would be ~dim native calls per chunk and visibly slower at 500-chunk scale.
                val emb = FloatArray(dim)
                val embBuf = ByteArray(dim * 4).also { input.readFully(it) }
                val bb = ByteBuffer.wrap(embBuf).order(ByteOrder.LITTLE_ENDIAN)

                for (d in 0 until dim) emb[d] = bb.float
                chunks.add(Chunk(id, source, heading, text, kind, emb))
            }
            return DocIndex(chunks, dim)
        }

        /**
         * Read a little-endian unsigned 16-bit integer from [input] as an [Int].
         *
         * Used for short length prefixes in the index format (id/source/heading byte counts). The result fits
         * in a signed [Int] without sign-extension surprises because the maximum value is 65535.
         *
         * @param input Stream positioned at the first of the two little-endian bytes; advanced by exactly 2 bytes.
         * @return The decoded value in `[0, 65535]`.
         * @throws java.io.EOFException If fewer than 2 bytes remain in [input].
         */
        private fun readU16LE(input: DataInputStream): Int {
            val b0 = input.readUnsignedByte()
            val b1 = input.readUnsignedByte()
            return b0 or (b1 shl 8)
        }

        /**
         * Read a little-endian unsigned 32-bit integer from [input] as an [Int].
         *
         * Used for header fields (version/count/dim) and the larger `text` length prefix. Values produced by
         * the indexer never exceed [Int.MAX_VALUE], so the unsigned-to-signed cast is a no-op in practice; a
         * malformed stream that overflows would surface as a negative length and fail the next read.
         *
         * @param input Stream positioned at the first of the four little-endian bytes; advanced by exactly 4 bytes.
         * @return The decoded value, reinterpreted as a signed [Int].
         * @throws java.io.EOFException If fewer than 4 bytes remain in [input].
         */
        private fun readU32LE(input: DataInputStream): Int {
            val b0 = input.readUnsignedByte()
            val b1 = input.readUnsignedByte()
            val b2 = input.readUnsignedByte()
            val b3 = input.readUnsignedByte()
            return b0 or (b1 shl 8) or (b2 shl 16) or (b3 shl 24)
        }

        /**
         * Read [byteLen] bytes from [input] and decode them as a UTF-8 string.
         *
         * Pairs with the [readU16LE]/[readU32LE] length prefixes that precede every variable-length string in
         * the index format. Reads exactly [byteLen] bytes - partial reads are not tolerated, matching the
         * indexer's fixed-layout writes.
         *
         * @param input Stream positioned at the start of the encoded bytes; advanced by exactly [byteLen] bytes.
         * @param byteLen Number of UTF-8 bytes to consume; must be non-negative.
         * @return The decoded string.
         * @throws java.io.EOFException If fewer than [byteLen] bytes remain in [input].
         */
        private fun readString(input: DataInputStream, byteLen: Int): String {
            val bytes = ByteArray(byteLen).also { input.readFully(it) }
            return String(bytes, Charsets.UTF_8)
        }
    }
}
