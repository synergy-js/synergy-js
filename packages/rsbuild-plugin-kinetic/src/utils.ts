import type MagicString from "magic-string"
import { type Expression, type JSXElementName, type JSXEmptyExpression } from "oxc-parser"

export const isComponentTag = (nameNode: JSXElementName): boolean => {
	if(nameNode.type === "JSXIdentifier") {
		const firstChar = nameNode.name[0]
		return firstChar !== undefined && firstChar >= "A" && firstChar <= "Z"
	}
	// <Ctx.Provider> or <UI.Button>
	return nameNode.type === "JSXMemberExpression"
}

/**
 * returns true for CallExpression (setCount((_n) => count() + 1))
 * @param {Expression | JSXEmptyExpression} expr
 * @returns {expr is Expression}
 */
export const isDynamicExpr = (expr: Expression | JSXEmptyExpression): expr is Expression => {
	switch(expr.type) {
		case "JSXEmptyExpression": // Prevents {/* comments */} from turning into {() => (/* comments */)}!
		case "Literal":
		case "ArrowFunctionExpression":
		case "FunctionExpression":
			return false
		
		case "TemplateLiteral":
			// Only dynamic if it actually interpolates `${...}` expressions
			return expr.expressions.length > 0
		
		case "UnaryExpression":
			// Static negative numbers like `count={-1}` don't need an effect
			return expr.argument.type !== "Literal"
		
		default:
			return true
	}
}


/**
 * Wrapping dynamic JSX expressions in wrapExpr lets developers write natural
 * JavaScript expressions `{count()}` instead of manually wrapping every reactive
 * read in a closure vs `{() => count()}`
 * @param {Expression | JSXEmptyExpression} expr
 * @param {MagicString} s
 */
export const wrapExpr = (expr: Expression | JSXEmptyExpression, s: MagicString): void => {
	if(!isDynamicExpr(expr)) {
		return
	}
	s.prependLeft(expr.start, "() => (")
	s.appendRight(expr.end, ")")
}


/**
 * To guarantee {userId} (passing the signal reference directly) and {userId()} (calling the signal) both work identically without special compiler heuristics:
 * @param val
 * @returns {unknown}
 */
const resolveReactive = (val: unknown): unknown => {
	while(typeof val === "function") {
		val = (val as () => unknown)()
	}
	return val
}