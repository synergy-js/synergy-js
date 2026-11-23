import type { PropertiesHyphen } from "csstype"

export type CSSProperties = PropertiesHyphen<string | number> & {[customVar: `--${string}`]: string | number}

export type PseudoSelector =
	| "&:hover"
	| "&:focus"
	| "&:focus-visible"
	| "&:active"
	| "&:disabled"
	| "&:first-child"
	| "&:last-child"
	| "&::before"
	| "&::after"
	| (`&${string}` & {})

export type StyleRule = CSSProperties & { [K in PseudoSelector]?: CSSProperties; } & {[atRule: `@${string}`]: CSSProperties}

let atomId = 0
const atomCache = new Map<string, string>()      // "background-color:red" -> "syn-0"
const classToSlot = new Map<string, string>()    // "syn-0" -> "background-color"

const sheet = new CSSStyleSheet()
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]

const getOrInsertAtom = (
	slot: string,
	value: string | number,
	buildRule: (className: string) => string,
): string => {
	const cacheKey = `${slot}:${value}`
	let className = atomCache.get(cacheKey)
	
	if(!className) {
		className = `syn-${(atomId++).toString(36)}`
		atomCache.set(cacheKey, className)
		classToSlot.set(className, slot)
		sheet.insertRule(buildRule(className), sheet.cssRules.length)
	}
	
	return className
}


/**
 * @template T
 * @param {Record<T, StyleRule>} styles
 * @returns {Record<T, string>}
 * @example
 * ```ts
 * const styles = createStyleSheet({
 *   btn: {
 *     "background-color": "#2563eb", // <-- IDE autocompletes property AND values!
 *     display: "inline-flex",        // <-- Ctrl+Space suggests "flex" | "inline-flex" | "grid"...
 *     "align-items": "center",
 *     padding: "8px 16px",
 *     "&:hover": {                   // <-- Ctrl+Space suggests "&:hover" | "&:focus-visible"...
 *       "background-color": "#1d4ed8",
 *     },
 *   },
 *   danger: {
 *     "background-color": "#dc2626", // Overwrites btn's background-color cleanly!
 *   },
 * });
 *
 * // Even if `danger` was inserted into CSSStyleSheet BEFORE `btn`,
 * // cx() strips `btn`'s background-color class so `danger` ALWAYS wins:
 * <button class={cx(styles.btn, isDanger() && styles.danger)}>Delete</button>
 * ```
 */
export const createStyleSheet = <T extends string>(styles: Record<T, StyleRule>): Record<T, string> => {
	const result = {} as Record<T, string>
	
	for(const key in styles) {
		const ruleBlock = styles[key]
		const classes: string[] = []
		
		for(const prop in ruleBlock) {
			const val = ruleBlock[prop as keyof StyleRule]
			if(val == null) {
				continue
			}
			
			if(prop.startsWith("&") && typeof val === "object") {
				const suffix = prop.slice(1)
				for(const subProp in val) {
					const subVal = val[subProp as keyof CSSProperties]
					if(subVal == null) {
						continue
					}
					classes.push(
						getOrInsertAtom(
							`${suffix}|${subProp}`,
							subVal,
							(cls) => `.${cls}${suffix}{${subProp}:${subVal}}`,
						),
					)
				}
				continue
			}
			
			if(prop.startsWith("@") && typeof val === "object") {
				for(const subProp in val) {
					const subVal = val[subProp as keyof CSSProperties]
					if(subVal == null) {
						continue
					}
					classes.push(
						getOrInsertAtom(
							`${prop}|${subProp}`,
							subVal,
							(cls) => `${prop}{.${cls}{${subProp}:${subVal}}}`,
						),
					)
				}
				continue
			}
			
			classes.push(
				getOrInsertAtom(
					prop,
					val as string | number,
					(cls) => `.${cls}{${prop}:${val}}`,
				),
			)
		}
		
		result[key] = classes.join(" ")
	}
	
	return result
}

/**
 * Last-wins atomic class merger (prevents CSS insertion-order specificity bugs)
 * @param {string | false | null | undefined} inputs
 * @returns {string}
 * @example
 * ```ts
 * const styles = createStyleSheet({
 *   btn: {
 *     "background-color": "#2563eb", // <-- IDE autocompletes property AND values!
 *     display: "inline-flex",        // <-- Ctrl+Space suggests "flex" | "inline-flex" | "grid"...
 *     "align-items": "center",
 *     padding: "8px 16px",
 *     "&:hover": {                   // <-- Ctrl+Space suggests "&:hover" | "&:focus-visible"...
 *       "background-color": "#1d4ed8",
 *     },
 *   },
 *   danger: {
 *     "background-color": "#dc2626", // Overwrites btn's background-color cleanly!
 *   },
 * });
 *
 * // Even if `danger` was inserted into CSSStyleSheet BEFORE `btn`,
 * // cx() strips `btn`'s background-color class so `danger` ALWAYS wins:
 * <button class={cx(styles.btn, isDanger() && styles.danger)}>Delete</button>
 * ```
 */
export const cx: (...inputs: (string | false | null | undefined)[]) => string = (...inputs: (string | false | null | undefined)[]): string => {
	const resolvedSlots = new Map<string, string>()
	const passthrough: string[] = []
	
	for(let i = 0; i < inputs.length; i++) {
		const chunk = inputs[i]
		if(!chunk) continue
		
		const tokens = chunk.split(" ")
		for(let j = 0; j < tokens.length; j++) {
			const cls = tokens[j]
			if(!cls) continue
			
			const slot = classToSlot.get(cls)
			if(slot) {
				// Later class for the same property slot overwrites the earlier one!
				resolvedSlots.set(slot, cls)
			}
			else {
				passthrough.push(cls)
			}
		}
	}
	
	return [...passthrough, ...resolvedSlots.values()].join(" ")
}

// 1. Define your design tokens once (injects `:root { --syn-... }` into your adopted sheet)
/**
 * @template TTokens
 * @param {TTokens} tokens
 * @returns {{[K in keyof TTokens]: {[P in keyof TTokens[K]]: string}}}
 * @example
 * ```ts
 * export const theme = defineTokens({
 *   colors: {
 *     primary: "#2563eb",
 *     primaryHover: "#1d4ed8",
 *     danger: "#dc2626",
 *     surface: "#18181b",
 *     text: "#f4f4f5",
 *   },
 *   space: {
 *     sm: "0.5rem",
 *     md: "1rem",
 *     lg: "1.5rem",
 *   },
 *   radius: {
 *     md: "6px",
 *     full: "9999px",
 *   },
 * })
 *
 * const styles = createStyleSheet({
 *   card: {
 *     "background-color": theme.colors.surface, // Autocompletes `theme.colors.*`!
 *     color: theme.colors.text,
 *     padding: theme.space.md,
 *     "border-radius": theme.radius.md,
 *   },
 * });
 * ```
 */
export const defineTokens = <TTokens extends Record<string, Record<string, string | number>>>(tokens: TTokens,
): { [K in keyof TTokens]: { [P in keyof TTokens[K]]: string } } => {
	const vars: string[] = []
	const refs = {} as Record<string, Record<string, string>>
	
	for(const group in tokens) {
		refs[group] = {}
		for(const token in tokens[group]) {
			const cssVar = `--syn-${group}-${token}`
			vars.push(`${cssVar}:${tokens[group][token]}`)
			refs[group][token] = `var(${cssVar})`
		}
	}
	
	if(vars.length > 0) {
		sheet.insertRule(`:root{${vars.join(";")}}`, sheet.cssRules.length)
	}
	
	return refs as { [K in keyof TTokens]: { [P in keyof TTokens[K]]: string } }
}
