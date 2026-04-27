/**
 * Build-time chunker that turns Kotlin source files into RAG-ready chunks.
 *
 * Uses tree-sitter-kotlin to walk the AST and emit:
 *   - one "header" chunk per class/object/interface (KDoc + declaration up to the opening brace)
 *   - one chunk per method / top-level function (KDoc + full function source)
 *   - nested classes recurse with their parent class name in the heading hierarchy
 *
 * Each chunk carries `kind: "code"` so the index format and section expansion can distinguish it from
 * markdown documentation chunks.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import Parser from "tree-sitter"
import Kotlin from "tree-sitter-kotlin"

export interface KotlinChunk {
	id: string
	source: string
	heading: string
	text: string
	kind: "code"
}

const DECL_TYPES = new Set([
	"class_declaration",
	"object_declaration",
	"interface_declaration",
	"enum_class_declaration",
	"function_declaration",
	"companion_object",
])

const CONTAINER_TYPES = new Set([
	"class_declaration",
	"object_declaration",
	"interface_declaration",
	"enum_class_declaration",
	"companion_object",
])

let _parser: Parser | null = null
function getParser(): Parser {
	if (!_parser) {
		_parser = new Parser()
		_parser.setLanguage(Kotlin as unknown as Parser.Language)
	}
	return _parser
}

export function chunkKotlinFile(filePath: string): KotlinChunk[] {
	const src = fs.readFileSync(filePath, "utf-8")
	const tree = getParser().parse(src)
	const filename = path.basename(filePath)

	const kdocByEnd = collectKDocs(tree.rootNode, src)
	const chunks: KotlinChunk[] = []
	walk(tree.rootNode, src, filename, [], kdocByEnd, chunks)
	return chunks
}

function collectKDocs(root: Parser.SyntaxNode, src: string): Map<number, string> {
	const out = new Map<number, string>()
	const stack: Parser.SyntaxNode[] = [root]
	while (stack.length > 0) {
		const node = stack.pop()!
		if (node.type === "multiline_comment") {
			const text = src.slice(node.startIndex, node.endIndex)
			if (text.startsWith("/**")) out.set(node.endIndex, text)
		}
		for (const c of node.children) stack.push(c)
	}
	return out
}

function findKDocBefore(declStart: number, src: string, kdocByEnd: Map<number, string>): string | null {
	let i = declStart - 1
	while (i >= 0 && /\s/.test(src[i])) i--
	const cursor = i + 1
	return kdocByEnd.get(cursor) ?? null
}

function walk(
	node: Parser.SyntaxNode,
	src: string,
	source: string,
	hierarchy: string[],
	kdocByEnd: Map<number, string>,
	out: KotlinChunk[],
): void {
	for (const child of node.children) {
		if (!DECL_TYPES.has(child.type)) {
			walk(child, src, source, hierarchy, kdocByEnd, out)
			continue
		}

		const name = declarationName(child, src) ?? (child.type === "companion_object" ? "Companion" : `<${child.type}>`)
		const kdoc = findKDocBefore(child.startIndex, src, kdocByEnd)
		const isContainer = CONTAINER_TYPES.has(child.type)

		if (isContainer) {
			const headerEnd = findContainerHeaderEnd(child)
			const headerSource = src.slice(child.startIndex, headerEnd)
			const headerText = combineWithKDoc(kdoc, headerSource).trim()
			const headerHierarchy = [...hierarchy, name]
			// Skip nearly-empty headers (e.g. bare `companion object` with no KDoc) - they add noise without signal.
			if (kdoc !== null || headerText.length > 30) {
				out.push({
					id: `${source}#${headerHierarchy.join(".")}`,
					source,
					heading: headerHierarchy.join(" › "),
					text: headerText,
					kind: "code",
				})
			}
			const body = child.childForFieldName("body") ?? findBody(child)
			if (body) walk(body, src, source, headerHierarchy, kdocByEnd, out)
		} else {
			const funcSource = src.slice(child.startIndex, child.endIndex)
			const funcText = combineWithKDoc(kdoc, funcSource).trim()
			const memberHierarchy = [...hierarchy, name]
			out.push({
				id: `${source}#${memberHierarchy.join(".")}`,
				source,
				heading: memberHierarchy.join(" › "),
				text: funcText,
				kind: "code",
			})
		}
	}
}

function declarationName(node: Parser.SyntaxNode, src: string): string | null {
	const named = node.childForFieldName("name")
	if (named) return src.slice(named.startIndex, named.endIndex)
	for (const c of node.children) {
		if (c.type === "simple_identifier" || c.type === "type_identifier") {
			return src.slice(c.startIndex, c.endIndex)
		}
	}
	return null
}

function combineWithKDoc(kdoc: string | null, body: string): string {
	return kdoc ? `${kdoc}\n${body}` : body
}

function findContainerHeaderEnd(node: Parser.SyntaxNode): number {
	const body = node.childForFieldName("body") ?? findBody(node)
	if (body) return body.startIndex
	return node.endIndex
}

function findBody(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
	for (const c of node.children) {
		if (c.type === "class_body" || c.type === "enum_class_body" || c.type === "object_literal") return c
	}
	return null
}

export function findKotlinFiles(rootDir: string): string[] {
	const out: string[] = []
	const stack: string[] = [rootDir]
	while (stack.length > 0) {
		const dir = stack.pop()!
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name)
			if (entry.isDirectory()) stack.push(full)
			else if (entry.isFile() && entry.name.endsWith(".kt")) out.push(full)
		}
	}
	out.sort()
	return out
}
