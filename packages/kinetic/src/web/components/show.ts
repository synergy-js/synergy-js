import type { JSXElement, JSXChild, Accessor } from "../../types.ts"
import { renderFragment } from "../utils.js"
import { createEffect, onCleanup, runWithOwner } from "../../signals"

export interface ShowProps<T> {
	when: T | undefined | null | false | Accessor<T | undefined | null | false>
	fallback?: JSXChild
	children?: JSXChild | ((item: NonNullable<T>) => JSXChild)
}

/** Render children when `when` is truthy, otherwise render the optional fallback. */
export const Show = <T>(props: ShowProps<T>): JSXElement => {
	const resolveCondition = (): T | undefined | null | false => {
		const raw = props.when
		return typeof raw === "function" ? (raw as Accessor<T | undefined | null | false>)() : raw
	}
	
	const anchor = document.createComment("jsxr-show")
	const container = document.createDocumentFragment()
	container.appendChild(anchor)
	
	let activeNodes: Node[] = []
	let disposeBranch: (() => void) | null = null
	let prevTruthy: boolean | null = null
	let prevValue: unknown = undefined
	
	createEffect(() => {
		const value = resolveCondition()
		const isTruthy = Boolean(value)
		const rawChildren = props.children
		// Loader-generated __children thunks have 0 args; user render props `(item) => ...` have >= 1 arg
		const isKeyedRenderProp = typeof rawChildren === "function" && rawChildren.length > 0
		
		// Skip DOM rebuild if branch state hasn't changed
		if(prevTruthy === isTruthy) {
			if(!isTruthy || !isKeyedRenderProp || Object.is(prevValue, value)) {
				return
			}
		}
		prevTruthy = isTruthy
		prevValue = value
		
		disposeBranch?.()
		disposeBranch = null
		for(let i = 0; i < activeNodes.length; i++) {
			activeNodes[i].parentNode?.removeChild(activeNodes[i])
		}
		activeNodes = []
		
		const owned = runWithOwner(() => {
			if(!isTruthy) {
				return renderFragment(props.fallback ?? null)
			}
			const resolved =
				typeof rawChildren === "function"
				? (rawChildren as (item: NonNullable<T>) => JSXChild)(value as NonNullable<T>)
				: rawChildren
			return renderFragment(resolved)
		})
		
		disposeBranch = owned.dispose
		activeNodes = Array.from(owned.result.dom.childNodes)
		anchor.parentNode?.insertBefore(owned.result.dom, anchor.nextSibling)
	})
	
	onCleanup(() => disposeBranch?.())
	
	return {tagName: "", props: {}, children: [], dom: container}
}