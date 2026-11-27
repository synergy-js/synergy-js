import { createEffect, runWithOwner } from "@synergy-js/signals"
import type { JSXRenderNode, JSXChild, MatchDescriptor } from "./types.js"

// Helper to flatten any resolved JSXChild into an array of real DOM Nodes
const normalizeToNodes = (value: unknown, out: Node[] = []): Node[] => {
	while(typeof value === "function") {
		value = (value as () => unknown)()
	}
	
	if(value == null || typeof value === "boolean") {
		return out
	}
	
	if(Array.isArray(value)) {
		for(let i = 0; i < value.length; i++) {
			normalizeToNodes(value[i], out)
		}
		return out
	}
	
	if(value instanceof DocumentFragment) {
		// Capture childNodes before insertion empties the fragment
		const children = value.childNodes
		for(let i = 0; i < children.length; i++) {
			out.push(children[i])
		}
		return out
	}
	
	if(value instanceof Node) {
		out.push(value)
		return out
	}
	
	if(typeof value === "object" && "dom" in value) {
		return normalizeToNodes((value as JSXRenderNode).dom, out)
	}
	
	out.push(document.createTextNode(String(value)))
	return out
}

export const applyAttribute = (el: HTMLElement, name: string, value: unknown): void => {
	if(name === "style" && typeof value === "object" && value !== null) {
		Object.assign(el.style, value)
	}
	else if(name === "value" && "value" in el) {
		(el as HTMLInputElement).value = value == null ? "" : String(value)
	}
	else if(name === "checked" && "checked" in el) {
		(el as HTMLInputElement).checked = Boolean(value)
	}
	else if(value === true) {
		el.setAttribute(name, "")
	}
	else if(value == null || value === false) {
		el.removeAttribute(name)
	}
	else if(typeof value !== "object") {
		el.setAttribute(name, String(value))
	}
}

export const appendDomChildren = (parent: Node, child: JSXChild): void => {
	if(Array.isArray(child)) {
		for(let i = 0; i < child.length; i++) {
			appendDomChildren(parent, child[i])
		}
		return
	}
	
	if(child == null || typeof child === "boolean") {
		return
	}
	
	if(child instanceof Node) {
		parent.appendChild(child)
		return
	}
	
	if(typeof child === "object" && "dom" in child) {
		parent.appendChild(child.dom)
		return
	}
	
	if(typeof child === "function") {
		// Anchor marker in the DOM (invisible in DevTools or use document.createComment(""))
		const marker = document.createComment("")
		parent.appendChild(marker)
		
		let currentNodes: Node[] = []
		
		createEffect(() => {
			const nextNodes = normalizeToNodes(child())
			
			// Fast path: single text node update in-place without DOM removal/insertion
			if(
				currentNodes.length === 1 &&
				nextNodes.length === 1 &&
				currentNodes[0].nodeType === Node.TEXT_NODE &&
				nextNodes[0].nodeType === Node.TEXT_NODE
			) {
				if(currentNodes[0].nodeValue !== nextNodes[0].nodeValue) {
					currentNodes[0].nodeValue = nextNodes[0].nodeValue
				}
				return
			}
			
			// Remove previously mounted nodes
			for(let i = 0; i < currentNodes.length; i++) {
				const node = currentNodes[i]
				if(node.parentNode) {
					node.parentNode.removeChild(node)
				}
			}
			
			// Insert new nodes immediately after the marker (using marker.parentNode in case parent was a DocumentFragment)
			const host = marker.parentNode
			if(host) {
				let ref: Node = marker
				for(let i = 0; i < nextNodes.length; i++) {
					const next = nextNodes[i]
					host.insertBefore(next, ref.nextSibling)
					ref = next
				}
			}
			
			currentNodes = nextNodes
		})
		return
	}
	
	parent.appendChild(document.createTextNode(String(child)))
}

export const collectMatches = (raw: JSXChild, out: MatchDescriptor[]): void => {
	if(Array.isArray(raw)) {
		for(let i = 0; i < raw.length; i++) {
			collectMatches(raw[i], out)
		}
		return
	}
	if(typeof raw === "object" && raw !== null && "__jsxrMatch" in raw) {
		out.push(raw as unknown as MatchDescriptor)
	}
}

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"])

const escapeHtml = (str: string): string =>
	str.replace(/[&<>"']/g, (ch) =>
		ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === "\"" ? "&quot;" : "&#39;",
	)

export const renderFragment = (rawChildren: JSXChild): JSXRenderNode => {
	const children: JSXChild[] = rawChildren == null ? [] : Array.isArray(rawChildren) ? rawChildren : [rawChildren]
	
	if(typeof document === "undefined") {
		return {
			tagName: "",
			props: {},
			children,
			dom: null!,
		}
	}
	
	const frag = document.createDocumentFragment()
	appendDomChildren(frag, children)
	
	return {
		tagName: "",
		props: {},
		children,
		dom: frag,
	}
}

export const renderToString = (app: unknown): string => {
	const owned = runWithOwner(() => (typeof app === "function" ? (app as () => JSXChild)() : (app as JSXChild)))
	try {
		return serializeNode(owned.result)
	}
	finally {
		owned.dispose()
	}
}

const serializeNode = (node: JSXChild): string => {
	while(typeof node === "function") {
		node = (node as () => JSXChild)()
	}
	if(node == null || typeof node === "boolean") return ""
	if(Array.isArray(node)) return node.map(serializeNode).join("")
	if(typeof node !== "object" || !("tagName" in node)) return escapeHtml(String(node))
	
	const {tagName, props, children} = node
	if(!tagName) return children.map(serializeNode).join("") // Fragment
	
	let attrs = ""
	for(const [k, rawVal] of Object.entries(props)) {
		const val = typeof rawVal === "function" ? (rawVal as () => unknown)() : rawVal
		if(val == null || val === false || k === "style" && typeof val !== "string") continue
		attrs += val === true ? ` ${k}` : ` ${k}="${escapeHtml(String(val))}"`
	}
	
	if(VOID_TAGS.has(tagName)) return `<${tagName}${attrs}>`
	return `<${tagName}${attrs}>${children.map(serializeNode).join("")}</${tagName}>`
}
