import { Accessor, createEffect, onCleanup, runWithOwner } from "@synergy-js/signals"
import { JSXRenderNode, JSXChild } from "../types.js"
import { renderFragment } from "../utils.js"

export interface ShowProps<T> {
	when: T | undefined | null | false | Accessor<T | undefined | null | false>
	fallback?: JSXChild
	children?: JSXChild | ((item: NonNullable<T>) => JSXChild)
}

export function Show<T>(props: ShowProps<T>): JSXRenderNode {
	const resolveCondition = (): T | undefined | null | false =>
		typeof props.when === "function"
		? (props.when as Accessor<T | undefined | null | false>)()
		: props.when
	
	const renderBranch = (value: T | undefined | null | false): JSXRenderNode => {
		if(!value) return renderFragment(props.fallback ?? null)
		const resolved =
			typeof props.children === "function"
			? (props.children as (item: NonNullable<T>) => JSXChild)(value as NonNullable<T>)
			: props.children
		return renderFragment(resolved)
	}
	
	if(typeof props.when !== "function") {
		return renderBranch(props.when)
	}
	
	const anchor = document.createComment("jsxr-show")
	const container = document.createDocumentFragment()
	container.appendChild(anchor)
	
	let activeNodes: Node[] = []
	let disposeBranch: (() => void) | null = null
	
	createEffect(() => {
		disposeBranch?.()
		disposeBranch = null
		for(let i = 0; i < activeNodes.length; i++) {
			activeNodes[i].parentNode?.removeChild(activeNodes[i])
		}
		activeNodes = []
		
		const owned = runWithOwner(() => renderBranch(resolveCondition()))
		disposeBranch = owned.dispose
		activeNodes = Array.from(owned.result.dom.childNodes)
		anchor.parentNode?.insertBefore(owned.result.dom, anchor.nextSibling)
	})
	
	onCleanup(() => disposeBranch?.())
	
	return {tagName: "", props: {}, children: [], dom: container}
}