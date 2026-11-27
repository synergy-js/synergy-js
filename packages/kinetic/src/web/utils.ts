import { createEffect, runWithOwner } from "@synergy-js/signals"
import type { JSXRenderNode, JSXChild, MatchDescriptor } from "./types.js"

// Iterative flattening of any resolved JSXChild into real DOM Nodes
const normalizeToNodes = (root: unknown, out: Node[] = []): Node[] => {
	const stack: unknown[] = [root]
	
	while(stack.length > 0) {
		let value = stack.pop()
		
		while(typeof value === "function") {
			value = (value as () => unknown)()
		}
		
		if(value == null || typeof value === "boolean") {
			continue
		}
		
		if(Array.isArray(value)) {
			for(let i = value.length - 1; i >= 0; i--) {
				stack.push(value[i])
			}
			continue
		}
		
		if(value instanceof DocumentFragment) {
			const children = value.childNodes
			for(let i = 0; i < children.length; i++) {
				out.push(children[i])
			}
			continue
		}
		
		if(value instanceof Node) {
			out.push(value)
			continue
		}
		
		if(typeof value === "object" && "dom" in value) {
			stack.push((value as JSXRenderNode).dom)
			continue
		}
		
		out.push(document.createTextNode(String(value)))
	}
	
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
	const stack: JSXChild[] = [child]
	
	while(stack.length > 0) {
		const current = stack.pop()
		
		if(Array.isArray(current)) {
			for(let i = current.length - 1; i >= 0; i--) {
				stack.push(current[i])
			}
			continue
		}
		
		if(current == null || typeof current === "boolean") {
			continue
		}
		
		if(current instanceof Node) {
			parent.appendChild(current)
			continue
		}
		
		if(typeof current === "object" && "dom" in current) {
			parent.appendChild(current.dom)
			continue
		}
		
		if(typeof current === "function") {
			const marker = document.createComment("")
			parent.appendChild(marker)
			
			let currentNodes: Node[] = []
			
			createEffect(() => {
				const nextNodes = normalizeToNodes(current())
				
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
				
				for(let i = 0; i < currentNodes.length; i++) {
					const node = currentNodes[i]
					if(node.parentNode) {
						node.parentNode.removeChild(node)
					}
				}
				
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
			continue
		}
		
		parent.appendChild(document.createTextNode(String(current)))
	}
}


const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"])

const escapeHtml = (str: string): string =>
	str.replace(/[&<>"']/g, (ch) =>
		ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === "\"" ? "&quot;" : "&#39;",
	)

const serializeStyleObject = (styleObj: Record<string, unknown>): string => {
	let out = ""
	for(const [key, val] of Object.entries(styleObj)) {
		if(val == null || val === "") continue
		const kebab = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
		out += `${kebab}:${String(val)};`
	}
	return out
}

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
		return _serializeNode(owned.result)
	}
	finally {
		owned.dispose()
	}
}

// Iterative HTML serializer (pushes closing tags onto the stack as strings)
const _serializeNode = (root: JSXChild): string => {
	const stack: (JSXChild | {__closingTag: string})[] = [root]
	let html = ""
	
	while(stack.length > 0) {
		let node = stack.pop()
		
		if(typeof node === "object" && node !== null && "__closingTag" in node) {
			html += `</${node.__closingTag}>`
			continue
		}
		
		while(typeof node === "function") {
			node = (node as () => JSXChild)()
		}
		
		if(node == null || typeof node === "boolean") continue
		
		if(Array.isArray(node)) {
			for(let i = node.length - 1; i >= 0; i--) {
				stack.push(node[i])
			}
			continue
		}
		
		if(typeof node !== "object" || !("tagName" in node)) {
			html += escapeHtml(String(node))
			continue
		}
		
		const {tagName, props, children} = node
		if(!tagName) {
			for(let i = children.length - 1; i >= 0; i--) {
				stack.push(children[i])
			}
			continue
		}
		
		let attrs = ""
		for(const [k, rawVal] of Object.entries(props)) {
			const val = typeof rawVal === "function" ? (rawVal as () => unknown)() : rawVal
			if(val == null || val === false) continue
			if(k === "style" && typeof val === "object") {
				const serialized = serializeStyleObject(val as Record<string, unknown>)
				if(serialized) attrs += ` style="${escapeHtml(serialized)}"`
				continue
			}
			if(typeof val === "object") continue
			attrs += val === true ? ` ${k}` : ` ${k}="${escapeHtml(String(val))}"`
		}
		
		if(VOID_TAGS.has(tagName)) {
			html += `<${tagName}${attrs}>`
			continue
		}
		
		html += `<${tagName}${attrs}>`
		stack.push({__closingTag: tagName})
		for(let i = children.length - 1; i >= 0; i--) {
			stack.push(children[i])
		}
	}
	
	return html
}
