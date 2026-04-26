/**
 * In-memory vector store backing the documentation chatbot's retrieval step.
 *
 * Loads a compact binary index produced at build time by the indexer script, holding all chunk metadata plus
 * 384-dim L2-normalized embeddings. At a few hundred chunks × 384 floats × 4 bytes this is well under 1 MB of
 * RAM — linear cosine scan over the whole set is microseconds, no ANN datastructure needed at this scale.
 *
 * Binary format (little-endian):
 *   magic   : "UMADOCIX" (8 bytes)
 *   version : u32        (currently 1)
 *   count   : u32        number of chunks
 *   dim     : u32        embedding dimensionality
 *   chunks  : count × { idLen u16, id utf-8; sourceLen u16, source utf-8; headingLen u16, heading utf-8;
 *                       textLen u32, text utf-8; dim × f32 }
 */

const MAGIC = "UMADOCIX"
const VERSION = 2

export type ChunkKind = "doc" | "code"
const KIND_DOC = 0x01
const KIND_CODE = 0x02

/** A single retrievable piece of documentation. */
export interface Chunk {
	/** Stable identifier (e.g. `how_it_works.md#energy-management-0`). */
	id: string
	/** Source file name (e.g. `HOW_IT_WORKS.md`). */
	source: string
	/** Nearest enclosing markdown heading for display. */
	heading: string
	/** Raw chunk text shown verbatim when this chunk is cited. */
	text: string
	/** Whether this chunk came from documentation prose or from source code. */
	kind: ChunkKind
	/** L2-normalized embedding of `text`. */
	embedding: Float32Array
}

/** One retrieval result. Score is cosine similarity in [-1, 1]. */
export interface SearchResult {
	chunk: Chunk
	score: number
}

export class DocIndex {
	constructor(public readonly chunks: Chunk[], public readonly dim: number) {}

	/**
	 * Return the top-`k` chunks by cosine similarity to `query`.
	 * `query` must be L2-normalized and of length `dim`.
	 */
	search(query: Float32Array, k: number = 4): SearchResult[] {
		if (query.length !== this.dim) {
			throw new Error(`query dim ${query.length} != index dim ${this.dim}`)
		}
		const scored: SearchResult[] = new Array(this.chunks.length)
		for (let c = 0; c < this.chunks.length; c++) {
			const emb = this.chunks[c].embedding
			let dot = 0
			for (let i = 0; i < this.dim; i++) dot += query[i] * emb[i]
			scored[c] = { chunk: this.chunks[c], score: dot }
		}
		scored.sort((a, b) => b.score - a.score)
		return scored.length <= k ? scored : scored.slice(0, k)
	}

	/**
	 * Parse a `DocIndex` from the raw binary contents produced by the build-time indexer.
	 *
	 * @param data Full file contents as a `Uint8Array` (or anything with an underlying `ArrayBuffer`).
	 */
	static load(data: Uint8Array): DocIndex {
		const decoder = new TextDecoder("utf-8")
		const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
		let off = 0

		const magic = decoder.decode(data.subarray(off, off + 8))
		off += 8
		if (magic !== MAGIC) throw new Error(`bad magic: ${magic}`)

		const version = view.getUint32(off, true)
		off += 4
		if (version !== VERSION) throw new Error(`unsupported index version ${version}`)

		const count = view.getUint32(off, true)
		off += 4
		const dim = view.getUint32(off, true)
		off += 4

		const chunks: Chunk[] = new Array(count)
		for (let i = 0; i < count; i++) {
			const idLen = view.getUint16(off, true)
			off += 2
			const id = decoder.decode(data.subarray(off, off + idLen))
			off += idLen

			const sourceLen = view.getUint16(off, true)
			off += 2
			const source = decoder.decode(data.subarray(off, off + sourceLen))
			off += sourceLen

			const headingLen = view.getUint16(off, true)
			off += 2
			const heading = decoder.decode(data.subarray(off, off + headingLen))
			off += headingLen

			const textLen = view.getUint32(off, true)
			off += 4
			const text = decoder.decode(data.subarray(off, off + textLen))
			off += textLen

			const kindByte = view.getUint8(off)
			off += 1
			const kind: ChunkKind = kindByte === KIND_CODE ? "code" : "doc"

			const embedding = new Float32Array(dim)
			for (let d = 0; d < dim; d++) {
				embedding[d] = view.getFloat32(off, true)
				off += 4
			}
			chunks[i] = { id, source, heading, text, kind, embedding }
		}
		return new DocIndex(chunks, dim)
	}
}
