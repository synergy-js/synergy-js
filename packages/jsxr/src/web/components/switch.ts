import { Accessor, createEffect, onCleanup, runWithOwner } from "@synergy-js/signals"
import { JSXChild, JSXRenderNode, MatchDescriptor } from "../types.js"
import { collectMatches, renderFragment } from "../utils.js"

export interface SwitchProps {
	fallback?: JSXChild
	children?: JSXChild
}

export const Switch = (props: SwitchProps): JSXRenderNode => {
	const matches: MatchDescriptor[] = []
	collectMatches(props.children, matches)
	
	const anchor = document.createComment("usrv-switch")
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
			const resolved =
				typeof branch.children === "function"
				? (branch.children as (item: unknown) => JSXChild)(matchedValue)
				: branch.children
			return renderFragment(resolved)
		})
		
		disposeBranch = owned.dispose
		activeNodes = Array.from(owned.result.dom.childNodes)
		anchor.parentNode?.insertBefore(owned.result.dom, anchor.nextSibling)
	})
	
	onCleanup(() => disposeBranch?.())
	
	return {tagName: "", props: {}, children: [], dom: container}
}