import {
	createEffect,
	createSignal, onCleanup,
	runWithOwner,
} from "../../signals"
import type { JSXChild, JSXElement, Setter, Accessor } from "../../types.ts"
import { renderFragment } from "../utils.js"

export interface RowEntry<T> {
	item: T
	setIndex: Setter<number>
	nodes: Node[]
	dispose: () => void
}


export interface ForProps<T> {
	each: readonly T[] | Accessor<readonly T[]>
	fallback?: JSXChild
	children: (item: T, index: Accessor<number>) => JSXChild
}

/** Render a reactive list, reusing row nodes by item identity and updating indices. */
export const For = <T>(props: ForProps<T>): JSXElement => {
	const resolveList = (): readonly T[] => typeof props.each === "function" ? (props.each as Accessor<readonly T[]>)() : props.each
	
	const anchor = document.createComment("usrv-for")
	const container = document.createDocumentFragment()
	container.appendChild(anchor)
	
	let rows = new Map<T, RowEntry<T>>()
	let fallbackNodes: Node[] = []
	let disposeFallback: (() => void) | null = null
	
	createEffect(() => {
		const list = resolveList()
		const parent = anchor.parentNode ?? container
		
		if(list.length === 0) {
			for(const entry of rows.values()) {
				entry.dispose()
				for(let i = 0; i < entry.nodes.length; i++) {
					entry.nodes[i].parentNode?.removeChild(entry.nodes[i])
				}
			}
			rows.clear()
			
			if(props.fallback !== undefined && fallbackNodes.length === 0) {
				const owned = runWithOwner(() => renderFragment(props.fallback))
				disposeFallback = owned.dispose
				fallbackNodes = Array.from(owned.result.dom.childNodes)
				parent.insertBefore(owned.result.dom, anchor.nextSibling)
			}
			return
		}
		
		if(fallbackNodes.length > 0) {
			disposeFallback?.()
			disposeFallback = null
			for(let i = 0; i < fallbackNodes.length; i++) {
				fallbackNodes[i].parentNode?.removeChild(fallbackNodes[i])
			}
			fallbackNodes = []
		}
		
		const nextItems = new Set<T>(list)
		for(const [item, entry] of rows.entries()) {
			if(!nextItems.has(item)) {
				entry.dispose()
				for(let i = 0; i < entry.nodes.length; i++) {
					entry.nodes[i].parentNode?.removeChild(entry.nodes[i])
				}
				rows.delete(item)
			}
		}
		
		let cursor: Node = anchor
		const nextRows = new Map<T, RowEntry<T>>()
		
		for(let i = 0; i < list.length; i++) {
			const item = list[i]
			let entry = rows.get(item)
			
			if(entry === undefined) {
				const [index, setIndex] = createSignal(i)
				const owned = runWithOwner(() => renderFragment(props.children(item, index)))
				entry = {
					item,
					setIndex,
					nodes: Array.from(owned.result.dom.childNodes),
					dispose: owned.dispose,
				}
			}
			else {
				entry.setIndex(i)
			}
			
			for(let n = 0; n < entry.nodes.length; n++) {
				const node = entry.nodes[n]
				if(cursor.nextSibling !== node) {
					parent.insertBefore(node, cursor.nextSibling)
				}
				cursor = node
			}
			nextRows.set(item, entry)
		}
		
		rows = nextRows
	})
	onCleanup(() => {
		disposeFallback?.()
		disposeFallback = null
		for(const entry of rows.values()) {
			entry.dispose()
		}
		rows.clear()
	})
	return {tagName: "", props: {}, children: [], dom: container}
}