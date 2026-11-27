/**
 * Mimics the same architectural patterns pioneered by SolidJS and Svelte by solving specific problems
 * with client-side reactive libraries.
 *
 *
 * ### Syntactic Sugar `{count()} vs {() => count()}`
 *
 * Wrapping dynamic JSX expressions in `wrapExpr` lets developers write natural JavaScript
 * expressions `{count()}` instead of manually wrapping every reactive read in a closure `{() => count()}`.
 *
 *
 * ### Component Prop Reactivity `get ${propName}()`
 *
 * In runtime-only JSX frameworks, passing `value={count()}` to a child component eagerly evaluates `count()`
 * once during setup and loses reactivity.
 *
 * Converting dynamic props into `{...{ get ${propName}() { return (${exprCode}) } }}`
 * preserves lazy signal tracking a cross component boundaries without a Virtual DOM.
 *
 *
 * ### Lazy Children `get children()`
 *
 * Deferring child evaluation via a getter ensures `<Show>`, `<For>`, and `<Context.Provider>`
 * only mount and track children inside the proper reactive owner `(runWithOwner) `
 * rather than eagerly creating DOM nodes before the parent component even runs.
 *
 * @module ReactiveJS-Loader
 * */


import type { Rspack } from "rstack/app"
import MagicString from "magic-string"
import { parseSync, Visitor } from "oxc-parser"
import { isComponentTag, isDynamicExpr, wrapExpr } from "./utils.js"

export default function kineticLoader(this: Rspack.LoaderContext, source: string): void {
	const {program} = parseSync(this.resourcePath, source, {
		sourceType: "module",
	})
	
	const s = new MagicString(source)
	const componentChildren: {start: number; end: number; insertPos: number}[] = []
	
	const visitor = new Visitor({
		JSXOpeningElement(node) {
			const isComponent = isComponentTag(node.name)
			
			// 1. Native DOM elements: wrap dynamic attribute expressions in `() => expr`
			if(!isComponent) {
				for(const attr of node.attributes) {
					if(attr.type !== "JSXAttribute") {
						continue
					}
					const name = attr.name.type === "JSXIdentifier" ? attr.name.name : null
					if(!name || name === "ref" || name === "key") {
						continue
					}
					
					if(attr.value?.type === "JSXExpressionContainer") {
						const expr = attr.value.expression
						if(expr.type === "Identifier") {
							continue
						}
						
						// For event handlers: don't double-wrap if user already passed `() => ...` or `handleClick`
						if(name.length > 2 && name.toLowerCase().startsWith("on")) {
							if(
								expr.type === "ArrowFunctionExpression" ||
								expr.type === "FunctionExpression" ||
								//expr.type === "Identifier" ||
								expr.type === "MemberExpression"
							) {
								continue
							}
						}
						
						wrapExpr(expr, s)
					}
				}
				return
			}
			
			// 2. Components: collect dynamic props into a single `__getters` object
			// so SWC's object spread never eagerly evaluates them
			const getterEntries: string[] = []
			
			for(const attr of node.attributes) {
				if(attr.type !== "JSXAttribute") {
					continue
				}
				if(attr.name.type !== "JSXIdentifier") {
					continue
				}
				
				const propName = attr.name.name
				if(propName === "key" || propName === "ref") {
					continue
				}
				
				/*
				 * Component Prop Reactivity `get ${propName}()`:
				 *
				 * In runtime-only JSX frameworks, passing `value={count()}` to
				 * a child component eagerly evaluates `count()` once during setup and loses reactivity.
				 *
				 * Converting dynamic props into `{...{ get ${propName}() { return (${exprCode}) } }}` preserves
				 * lazy signal tracking across component boundaries without a Virtual DOM.
				 */
				if(attr.value?.type === "JSXExpressionContainer") {
					const expr = attr.value.expression
					if(isDynamicExpr(expr)) {
						const exprCode = source.slice(expr.start, expr.end)
						getterEntries.push(`${propName}: () => (${exprCode})`)
						s.remove(attr.start, attr.end)
					}
				}
			}
			
			if(getterEntries.length > 0) {
				const insertPos = node.selfClosing ? node.end - 2 : node.end - 1
				s.appendLeft(insertPos, ` __getters={{ ${getterEntries.join(", ")} }}`)
			}
		},
		
		JSXElement(node) {
			const isComponent = isComponentTag(node.openingElement.name)
			
			/*
			 * 3. Component children: wrap in lazy `__children` (unless it's a render-prop function like `{(u) => ...}`)
			 * Lazy Children (get children())
			 *
			 * Deferring child evaluation via a getter ensures `<Show>`, `<For>`, and `<Context.Provider> `
			 * only mount and track children inside the proper reactive owner (runWithOwner)
			 * rather than eagerly creating DOM nodes before the parent component even runs.
			 */
			if(isComponent && node.children.length > 0) {
				const nonEmptyChildren = node.children.filter(
					(c) => !(c.type === "JSXText" && c.value.trim() === ""),
				)
				
				// If the only child is a render prop `{(item) => ...}`, leave it as-is for <For> / <Match>
				const isRenderProp =
					nonEmptyChildren.length === 1 &&
					nonEmptyChildren[0].type === "JSXExpressionContainer" &&
					(nonEmptyChildren[0].expression.type === "ArrowFunctionExpression" ||
						nonEmptyChildren[0].expression.type === "FunctionExpression")
				
				if(!isRenderProp && nonEmptyChildren.length > 0) {
					const firstChild = node.children[0]!
					const lastChild = node.children[node.children.length - 1]!
					
					componentChildren.push({
						start: firstChild.start,
						end: lastChild.end,
						insertPos: node.openingElement.end - 1,
					})
				}
				return
			}
			
			// 4. Native DOM children: wrap dynamic `{expr}` in `() => expr`
			for(const child of node.children) {
				if(child.type === "JSXExpressionContainer") {
					wrapExpr(child.expression, s)
				}
			}
		},
		
		JSXFragment(node) {
			for(const child of node.children) {
				if(child.type === "JSXExpressionContainer") {
					wrapExpr(child.expression, s)
				}
			}
		},
	})
	
	visitor.visit(program)
	
	for(const {start, end, insertPos} of componentChildren.sort(
		(a, b) => (a.end - a.start) - (b.end - b.start),
	)) {
		const children = s.slice(start, end)
		s.remove(start, end)
		s.appendLeft(insertPos, ` __children={() => (<>${children}</>)}`)
	}
	
	const map = s.generateMap({
		source: this.resourcePath,
		file: this.resourcePath,
		includeContent: true,
		hires: true,
	})
	
	this.callback(null, s.toString(), map.toString())
}
