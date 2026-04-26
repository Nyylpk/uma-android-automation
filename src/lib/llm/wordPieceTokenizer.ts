/**
 * Minimal BERT-style WordPiece tokenizer for MiniLM-L6-v2 and other uncased BERT derivatives.
 *
 * Implements the uncased basic tokenization + WordPiece greedy-longest-match-first algorithm described in
 * Devlin et al. 2018. Output ids are compatible with the `sentence-transformers/all-MiniLM-L6-v2` ONNX model's
 * `input_ids` tensor.
 *
 * Not a general-purpose tokenizer: only supports the subset of BERT's behavior needed for embedding short
 * English queries and document chunks.
 */

export const CLS_ID = 101
export const SEP_ID = 102
export const PAD_ID = 0
export const UNK_ID = 100
export const MAX_SEQ_LEN = 128
const MAX_INPUT_CHARS_PER_WORD = 100

const ASCII_PUNCT_RANGES: ReadonlyArray<readonly [number, number]> = [
	[33, 47],
	[58, 64],
	[91, 96],
	[123, 126],
]
const UNICODE_PUNCT_RE = /\p{P}/u
const COMBINING_MARK_RE = /\p{Mn}/u
const WHITESPACE_RE = /\s/

/** Result of tokenizing a single piece of text for ONNX inference. */
export interface Encoded {
	/** Padded vocabulary ids of length `seqLen`. */
	inputIds: number[]
	/** 1 for real tokens, 0 for [PAD] padding, length `seqLen`. */
	attentionMask: number[]
	/** All zeros (single-segment input), length `seqLen`. */
	tokenTypeIds: number[]
	/** Padded sequence length (bounded by `MAX_SEQ_LEN`). */
	seqLen: number
}

export class WordPieceTokenizer {
	constructor(private readonly vocab: ReadonlyMap<string, number>) {}

	/**
	 * Build a tokenizer from the raw text contents of a BERT-style `vocab.txt` where each line is one
	 * wordpiece in id order (line 0 -> id 0, line 1 -> id 1, ...).
	 */
	static fromVocabText(text: string): WordPieceTokenizer {
		const vocab = new Map<string, number>()
		const lines = text.split(/\r?\n/)
		for (let i = 0; i < lines.length; i++) {
			const trimmed = lines[i].trim()
			vocab.set(trimmed, i)
		}
		return new WordPieceTokenizer(vocab)
	}

	/**
	 * Encode `text` into ONNX-ready tensors with `[CLS] ... [SEP]` framing and zero padding.
	 */
	encode(text: string, maxLen: number = MAX_SEQ_LEN): Encoded {
		const cappedMax = Math.min(maxLen, MAX_SEQ_LEN)
		const ids: number[] = [CLS_ID]
		const pieces = this.tokenize(text)
		for (const piece of pieces) {
			if (ids.length >= cappedMax - 1) break
			ids.push(this.vocab.get(piece) ?? UNK_ID)
		}
		ids.push(SEP_ID)

		const real = ids.length
		const padded: number[] = new Array(cappedMax)
		const mask: number[] = new Array(cappedMax)
		const types: number[] = new Array(cappedMax)
		for (let i = 0; i < cappedMax; i++) {
			padded[i] = i < real ? ids[i] : PAD_ID
			mask[i] = i < real ? 1 : 0
			types[i] = 0
		}
		return { inputIds: padded, attentionMask: mask, tokenTypeIds: types, seqLen: cappedMax }
	}

	/** Tokenize `text` into an ordered list of wordpieces (no special tokens, no ids). */
	tokenize(text: string): string[] {
		const basic = this.basicTokenize(text)
		const out: string[] = []
		for (const word of basic) {
			for (const piece of this.wordPieceTokenize(word)) out.push(piece)
		}
		return out
	}

	private basicTokenize(text: string): string[] {
		const normalized = stripAccents(text.toLowerCase())
		const tokens: string[] = []
		let current = ""
		for (const ch of normalized) {
			if (WHITESPACE_RE.test(ch)) {
				if (current.length > 0) {
					tokens.push(current)
					current = ""
				}
			} else if (isPunctuation(ch)) {
				if (current.length > 0) {
					tokens.push(current)
					current = ""
				}
				tokens.push(ch)
			} else {
				current += ch
			}
		}
		if (current.length > 0) tokens.push(current)
		return tokens
	}

	private wordPieceTokenize(word: string): string[] {
		if (word.length > MAX_INPUT_CHARS_PER_WORD) return ["[UNK]"]
		const pieces: string[] = []
		let start = 0
		while (start < word.length) {
			let end = word.length
			let matched: string | null = null
			while (start < end) {
				const sub = (start > 0 ? "##" : "") + word.substring(start, end)
				if (this.vocab.has(sub)) {
					matched = sub
					break
				}
				end -= 1
			}
			if (matched === null) return ["[UNK]"]
			pieces.push(matched)
			start = end
		}
		return pieces
	}
}

/** NFD-normalize and drop combining marks; equivalent to BERT's strip-accents pass. */
function stripAccents(text: string): string {
	const nfd = text.normalize("NFD")
	let out = ""
	for (const ch of nfd) {
		if (!COMBINING_MARK_RE.test(ch)) out += ch
	}
	return out
}

/** Match BERT's `_is_punctuation`: ASCII punct ranges plus any Unicode P* category. */
function isPunctuation(ch: string): boolean {
	const cp = ch.codePointAt(0)
	if (cp === undefined) return false
	for (const [lo, hi] of ASCII_PUNCT_RANGES) {
		if (cp >= lo && cp <= hi) return true
	}
	return UNICODE_PUNCT_RE.test(ch)
}
