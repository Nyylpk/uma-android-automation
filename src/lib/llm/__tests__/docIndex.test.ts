import * as fs from "node:fs"
import * as path from "node:path"
import { DocIndex } from "../docIndex"

function l2Normalize(v: number[]): Float32Array {
	let s = 0
	for (const x of v) s += x * x
	const n = Math.sqrt(s)
	const out = new Float32Array(v.length)
	if (n === 0) {
		for (let i = 0; i < v.length; i++) out[i] = v[i]
	} else {
		for (let i = 0; i < v.length; i++) out[i] = v[i] / n
	}
	return out
}

interface FixtureChunk {
	id: string
	source: string
	heading: string
	text: string
	embedding: Float32Array
}

function encodeIndex(chunks: FixtureChunk[], dim: number): Uint8Array {
	const enc = new TextEncoder()
	const parts: Uint8Array[] = []
	parts.push(enc.encode("UMADOCIX"))

	const headerVer = new ArrayBuffer(12)
	const headerView = new DataView(headerVer)
	headerView.setUint32(0, 2, true) // version
	headerView.setUint32(4, chunks.length, true) // count
	headerView.setUint32(8, dim, true) // dim
	parts.push(new Uint8Array(headerVer))

	for (const c of chunks) {
		const idBytes = enc.encode(c.id)
		const srcBytes = enc.encode(c.source)
		const headBytes = enc.encode(c.heading)
		const textBytes = enc.encode(c.text)

		const totalLen = 2 + idBytes.length + 2 + srcBytes.length + 2 + headBytes.length + 4 + textBytes.length + 1
		const lenBuf = new ArrayBuffer(totalLen)
		const lenView = new DataView(lenBuf)
		const lenArr = new Uint8Array(lenBuf)
		let off = 0
		lenView.setUint16(off, idBytes.length, true)
		off += 2
		lenArr.set(idBytes, off)
		off += idBytes.length
		lenView.setUint16(off, srcBytes.length, true)
		off += 2
		lenArr.set(srcBytes, off)
		off += srcBytes.length
		lenView.setUint16(off, headBytes.length, true)
		off += 2
		lenArr.set(headBytes, off)
		off += headBytes.length
		lenView.setUint32(off, textBytes.length, true)
		off += 4
		lenArr.set(textBytes, off)
		off += textBytes.length
		lenView.setUint8(off, 0x01) // kind = doc (test fixtures)
		parts.push(lenArr)

		const embBuf = new ArrayBuffer(dim * 4)
		const embView = new DataView(embBuf)
		for (let i = 0; i < dim; i++) embView.setFloat32(i * 4, c.embedding[i], true)
		parts.push(new Uint8Array(embBuf))
	}

	let total = 0
	for (const p of parts) total += p.length
	const out = new Uint8Array(total)
	let cursor = 0
	for (const p of parts) {
		out.set(p, cursor)
		cursor += p.length
	}
	return out
}

describe("DocIndex", () => {
	it("round-trips three chunks through the binary format", () => {
		const dim = 4
		const a = l2Normalize([1, 0, 0, 0])
		const b = l2Normalize([0, 1, 0, 0])
		const c = l2Normalize([0.8, 0.6, 0, 0])
		const bytes = encodeIndex(
			[
				{ id: "id-a", source: "README.md", heading: "Alpha", text: "alpha chunk", embedding: a },
				{ id: "id-b", source: "HOW_IT_WORKS.md", heading: "Bravo", text: "bravo chunk", embedding: b },
				{ id: "id-c", source: "README.md", heading: "Charlie", text: "charlie chunk", embedding: c },
			],
			dim,
		)
		const index = DocIndex.load(bytes)
		expect(index.chunks.length).toBe(3)
		expect(index.dim).toBe(4)
		expect(index.chunks[1].id).toBe("id-b")
		expect(index.chunks[1].source).toBe("HOW_IT_WORKS.md")
		expect(index.chunks[1].text).toBe("bravo chunk")
	})

	it("search returns exact match first", () => {
		const dim = 4
		const a = l2Normalize([1, 0, 0, 0])
		const b = l2Normalize([0, 1, 0, 0])
		const c = l2Normalize([0.8, 0.6, 0, 0])
		const bytes = encodeIndex(
			[
				{ id: "id-a", source: "A.md", heading: "A", text: "alpha", embedding: a },
				{ id: "id-b", source: "B.md", heading: "B", text: "bravo", embedding: b },
				{ id: "id-c", source: "C.md", heading: "C", text: "charlie", embedding: c },
			],
			dim,
		)
		const index = DocIndex.load(bytes)
		const results = index.search(a, 3)
		expect(results[0].chunk.id).toBe("id-a")
		expect(results[0].score).toBeGreaterThan(0.99)
		expect(results[0].score).toBeGreaterThan(results[1].score)
	})

	it("loads the production doc_index.bin asset", () => {
		const realIndexPath = path.resolve(
			__dirname,
			"../../../../android/app/src/main/assets/llm/doc_index.bin",
		)
		const buf = fs.readFileSync(realIndexPath)
		const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
		const index = DocIndex.load(u8)
		expect(index.dim).toBe(384)
		expect(index.chunks.length).toBeGreaterThan(0)
		const first = index.chunks[0]
		expect(first.id.length).toBeGreaterThan(0)
		expect(first.embedding.length).toBe(384)
		// L2-normalized: ||v||^2 ≈ 1
		let sumSq = 0
		for (let i = 0; i < first.embedding.length; i++) {
			sumSq += first.embedding[i] * first.embedding[i]
		}
		expect(sumSq).toBeGreaterThan(0.99)
		expect(sumSq).toBeLessThan(1.01)
	})

	it("search caps results at k", () => {
		const dim = 2
		const fixtures: FixtureChunk[] = []
		for (let i = 0; i < 10; i++) {
			fixtures.push({
				id: `id-${i}`,
				source: "S",
				heading: "H",
				text: `t-${i}`,
				embedding: l2Normalize([i, 1]),
			})
		}
		const bytes = encodeIndex(fixtures, dim)
		const index = DocIndex.load(bytes)
		const q = new Float32Array([1, 0])
		expect(index.search(q, 3).length).toBe(3)
	})
})
