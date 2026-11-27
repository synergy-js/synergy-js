import { createEffect, onCleanup, runWithOwner } from "../../signals"
import type { JSXChild, JSXElement, MatchDescriptor, Accessor } from "../../types.ts"
import { renderFragment } from "../utils.js"

export interface SwitchProps {
	fallback?: JSXChild
	children?: JSXChild
}

// Iterative <Switch> collector supporting thunks, arrays, and fragment JSXElements
const _collectSwitchMatches = (raw: JSXChild, out: MatchDescriptor[]): void => {
	const stack: JSXChild[] = [raw]
	
	while(stack.length > 0) {
		let current = stack.pop()
		
		while(typeof current === "function") {
			current = (current as () => JSXChild)()
		}
		
		if(Array.isArray(current)) {
			for(let i = current.length - 1; i >= 0; i--) {
				stack.push(current[i])
			}
			continue
		}
		
		if(typeof current === "object" && current !== null) {
			if("__jsxrMatch" in current) {
				out.push(current as unknown as MatchDescriptor)
			}
			else if("children" in current && Array.isArray((current as JSXElement).children)) {
				const children = (current as JSXElement).children
				for(let i = children.length - 1; i >= 0; i--) {
					stack.push(children[i])
				}
			}
		}
	}
}

/** Render the first truthy `Match` branch, or the fallback if none match. */
export const Switch = (props: SwitchProps): JSXElement => {
	const matches: MatchDescriptor[] = []
	_collectSwitchMatches(props.children, matches)
	
	const anchor = document.createComment("jsxr-switch")
	const container = document.createDocumentFragment()
	container.appendChild(anchor)
	
	let activeNodes: Node[] = []
	let disposeBranch: (() => void) | null = null
	let activeIndex = -2 // -2 = uninitialized, -1 = fallback, >= 0 = match index
	
	createEffect(() => {
		let matchedIndex = -1
		let matchedValue: unknown = undefined
		
		for(let i = 0; i < matches.length; i++) {
			const m = matches[i]
			const val = typeof m.when === "function" ? (m.when as Accessor<unknown>)() : m.when
			if(val) {
				matchedIndex = i
				matchedValue = val
				break
			}
		}
		
		// Skip DOM teardown if the exact same branch is still active
		if(matchedIndex === activeIndex && matchedIndex !== -1) {
			return
		}
		activeIndex = matchedIndex
		
		disposeBranch?.()
		disposeBranch = null
		for(let i = 0; i < activeNodes.length; i++) {
			activeNodes[i].parentNode?.removeChild(activeNodes[i])
		}
		activeNodes = []
		
		const owned = runWithOwner(() => {
			if(matchedIndex === -1) {
				return renderFragment(props.fallback ?? null)
			}
			const branch = matches[matchedIndex]
			const rawBranchChildren = branch.children
			const resolved =
				typeof rawBranchChildren === "function"
				? (rawBranchChildren as (item: unknown) => JSXChild)(matchedValue)
				: rawBranchChildren
			return renderFragment(resolved)
		})
		
		disposeBranch = owned.dispose
		activeNodes = Array.from(owned.result.dom.childNodes)
		anchor.parentNode?.insertBefore(owned.result.dom, anchor.nextSibling)
	})
	
	onCleanup(() => disposeBranch?.())
	
	return {tagName: "", props: {}, children: [], dom: container}
}