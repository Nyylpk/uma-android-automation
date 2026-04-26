import * as fs from "node:fs"
import * as path from "node:path"
import {
	WordPieceTokenizer,
	CLS_ID,
	SEP_ID,
	PAD_ID,
	MAX_SEQ_LEN,
} from "../wordPieceTokenizer"

const VOCAB_PATH = path.resolve(
	__dirname,
	"../../../../android/app/src/main/assets/llm/minilm-l6-v2-vocab.txt",
)

let tokenizer: WordPieceTokenizer

beforeAll(() => {
	const vocabText = fs.readFileSync(VOCAB_PATH, "utf-8")
	tokenizer = WordPieceTokenizer.fromVocabText(vocabText)
})

describe("WordPieceTokenizer", () => {
	it("encodes 'hello world' with correct framing and ids", () => {
		const encoded = tokenizer.encode("hello world")
		expect(encoded.seqLen).toBe(MAX_SEQ_LEN)
		expect(encoded.inputIds[0]).toBe(CLS_ID)
		expect(encoded.inputIds[1]).toBe(7592) // hello
		expect(encoded.inputIds[2]).toBe(2088) // world
		expect(encoded.inputIds[3]).toBe(SEP_ID)
		expect(encoded.inputIds[4]).toBe(PAD_ID)
		expect(encoded.attentionMask[0]).toBe(1)
		expect(encoded.attentionMask[4]).toBe(0)
	})

	it("lowercases and splits punctuation", () => {
		const pieces = tokenizer.tokenize("Hello, World!")
		expect(pieces).toEqual(["hello", ",", "world", "!"])
	})

	it("applies WordPiece ## continuation to OOV tokens", () => {
		const pieces = tokenizer.tokenize("unaffordable")
		expect(pieces.length).toBeGreaterThan(1)
		for (let i = 1; i < pieces.length; i++) {
			expect(pieces[i].startsWith("##")).toBe(true)
		}
	})

	it("strips accents (NFD + drop combining marks)", () => {
		const pieces = tokenizer.tokenize("café")
		expect(pieces.join("").replace(/##/g, "")).toBe("cafe")
	})

	it("truncates to maxLen while preserving [CLS] and [SEP]", () => {
		const longText = "hello ".repeat(200)
		const encoded = tokenizer.encode(longText, 16)
		expect(encoded.seqLen).toBe(16)
		expect(encoded.inputIds[0]).toBe(CLS_ID)
		expect(encoded.inputIds[15]).toBe(SEP_ID)
	})
})
