import { createEffect, onCleanup, runWithOwner, createBaseContext, untrack, type BaseContext } from "@synergy-js/signals"
import type { JSXComponent, JSXChild, ReactiveProps, JSXRenderNode, Context, ContextProviderProps } from "./types.js"
import { appendDomChildren, applyAttribute, renderFragment } from "./utils.js"

export const Fragment: symbol = Symbol.for("jsxr.dom.fragment")

export const jsx = <TTag extends keyof HTMLElementTagNameMap, TProps extends Record<string, unknown> = ReactiveProps<TTag>>(
	tag: TTag | JSXComponent<TProps & {children?: JSXChild}> | typeof Fragment,
	props: TProps & {children?: JSXChild},
	key?: string | number,
): JSXRenderNode => {
	
	if(tag === Fragment) {
		return renderFragment(props.children)
	}
	/*
	 *  untrack(() => tag(props)) ensures components run strictly
	 *  once as setup functions and never accidentally subscribe parent
	 *  <Show> / <For> effects to signals read during setup
	 * */
	if(typeof tag === "function") {
		//return tag(props)
		return untrack(() => tag(props))
	}
	
	const internalProps: Record<string, unknown> = {...props}
	
	if(key !== undefined) {
		internalProps["key"] = key
	}
	if("className" in internalProps) {
		internalProps["class"] = internalProps["className"]
		delete internalProps["className"]
	}
	
	const rawChildren = internalProps["children"] as JSXChild
	const children: JSXChild[] = rawChildren == null ? [] : Array.isArray(rawChildren) ? rawChildren : [rawChildren]
	delete internalProps["children"]
	
	const refCallback = internalProps["ref"] as ((el: HTMLElement) => void) | undefined
	delete internalProps["ref"]
	
	const el = document.createElement(tag.toString())
	const elementProps: Record<string, unknown> = {}
	
	for(const [k, v] of Object.entries(internalProps)) {
		if(k === "key" || v == null || v === false) continue
		
		const lowerKey = k.toLowerCase()
		if(lowerKey.startsWith("on") && typeof v === "function") {
			el.addEventListener(lowerKey.slice(2), v as EventListener)
			continue
		}
		
		elementProps[k] = v
		
		if(typeof v === "function") {
			createEffect(() => applyAttribute(el, k, (v as () => unknown)()))
		}
		else {
			applyAttribute(el, k, v)
		}
	}
	
	appendDomChildren(el, children)
	
	if(typeof refCallback === "function") {
		refCallback(el)
	}
	
	return {
		tagName: tag.toString(),
		props: elementProps,
		children,
		dom: el,
	}
}

export const jsxs: <TTag extends keyof HTMLElementTagNameMap, TProps extends Record<string, unknown> = ReactiveProps<TTag>>(tag: TTag | JSXComponent<TProps & {
	children?: JSXChild
}> | typeof Fragment, props: TProps & {
	children?: JSXChild
}, key?: string | number) => JSXRenderNode = jsx

export const jsxDEV: <TTag extends keyof HTMLElementTagNameMap, TProps extends Record<string, unknown> = ReactiveProps<TTag>>(tag: TTag | JSXComponent<TProps & {
	children?: JSXChild
}> | typeof Fragment, props: TProps & {
	children?: JSXChild
}, key?: string | number) => JSXRenderNode = jsx

export const onMount = (fn: () => void | (() => void)): void => {
	const cleanup = fn()
	if(typeof cleanup === "function") {
		onCleanup(cleanup)
	}
}

export const createContext = <T>(defaultValue: T): Context<T> => {
	const base: BaseContext<T> = createBaseContext(defaultValue)
	
	const Provider = (props: ContextProviderProps<T>): JSXRenderNode => {
		const owned = runWithOwner(() => {
				const resolved =
					typeof props.children === "function"
					? (props.children as () => JSXChild)()
					: props.children
				return renderFragment(resolved)
			},
			{id: base.id, value: props.value},
		)
		
		onCleanup(owned.dispose)
		return owned.result
	}
	
	return {...base, Provider}
}

export const mount = (app: JSXRenderNode | (() => JSXRenderNode), target: string | Element = "#root"): () => void => {
	const container = typeof target === "string" ? document.querySelector(target) : target
	
	if(!container) {
		throw new Error(`Mount target not found: ${String(target)}`)
	}
	
	container.replaceChildren()
	
	const owned = runWithOwner(() => (typeof app === "function" ? app() : app))
	container.appendChild(owned.result.dom)
	
	return () => {
		owned.dispose()
		container.replaceChildren()
	}
}

export namespace JSX {
	export type Element = JSXRenderNode
	
	export interface ElementChildrenAttribute {
		children: {}
	}
	
	export type IntrinsicElements = {
		[TTag in keyof HTMLElementTagNameMap]: ReactiveProps<TTag>
	}
}
