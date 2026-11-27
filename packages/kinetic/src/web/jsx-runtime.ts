import { createEffect, runWithOwner, untrack } from "@synergy-js/signals"
import type { JSXChild, JSXComponent, JSXRenderNode, ReactiveProps } from "./types.ts"
import { appendDomChildren, applyAttribute, renderFragment } from "./utils.js"

export const Fragment: symbol = Symbol.for("jsxr.dom.fragment")

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

export const jsx = <TTag extends keyof HTMLElementTagNameMap, TProps extends Record<string, unknown> = ReactiveProps<TTag>>(
	tag: TTag | JSXComponent<TProps & {children?: JSXChild}> | typeof Fragment,
	props: TProps & {children?: JSXChild},
	key?: string | number,
): JSXRenderNode => {
	
	if(tag === Fragment) {
		return renderFragment(props.children)
	}
	/*
	 * If props arrives with __getters and __children from the loader, tag(props) won't see props.value or props.children unless jsx()
	 * converts __getters and __children into real Object.defineProperty getters on props before calling tag(props
	 * */
	if(typeof tag === "function") {
		const componentProps: Record<string, unknown> = {...props}
		const getters = componentProps["__getters"] as Record<string, () => unknown> | undefined
		delete componentProps["__getters"]
		
		if(getters) {
			for(const [k, getter] of Object.entries(getters)) {
				Object.defineProperty(componentProps, k, {
					enumerable: true,
					configurable: true,
					get: getter,
				})
			}
		}
		
		if("__children" in componentProps) {
			const childrenThunk = componentProps["__children"] as () => JSXChild
			delete componentProps["__children"]
			Object.defineProperty(componentProps, "children", {
				enumerable: true,
				configurable: true,
				get: childrenThunk,
			})
		}
		/*
		 *  untrack(() => tag(props)) ensures components run strictly
		 *  once as setup functions and never accidentally subscribe parent
		 *  <Show> / <For> effects to signals read during setup
		 */
		return untrack(() => tag(componentProps as TProps & {children?: JSXChild}))
	}
	// if(typeof tag === "function") {
	//
	// 	return untrack(() => tag(props))
	// }
	
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
	
	// SSR / Server branch (no DOM available)
	if(typeof document === "undefined") {
		const elementProps: Record<string, unknown> = {}
		for(const [k, v] of Object.entries(internalProps)) {
			if(k === "key" || v == null || v === false || k.toLowerCase().startsWith("on")) continue
			elementProps[k] = v
		}
		return {
			tagName: tag.toString(),
			props: elementProps,
			children,
			dom: null!,
		}
	}
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

export namespace JSX {
	export type Element = JSXRenderNode
	
	export interface ElementChildrenAttribute {
		children: {}
	}
	
	export interface ElementClass {
		render(props: any): JSXRenderNode
	}
	
	export interface ElementAttributesProperty {
		props: {}
	}
	
	export type IntrinsicElements = {
		[TTag in keyof HTMLElementTagNameMap]: ReactiveProps<TTag>
	}
	
	// Keeps `(e: PointerEvent)` inference when writing a function,
	// while allowing any expression result (void, number, string, etc.) for the compiler!
	export type EventHandler<E extends Event = Event> = | ((event: E) => unknown) | ({} | null | undefined)
}
