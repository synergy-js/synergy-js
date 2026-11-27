import { getOrInsertAtom } from "./sheet.js"
import type { CSSProperties, NestedBlock, StyleRule } from "./types.js"

const _collectPseudo = (
	suffix: string,
	pseudoBlock: CSSProperties,
	classes: string[],
	atRulePrefix = "",
): void => {
	for(const subProp in pseudoBlock) {
		const subVal = pseudoBlock[subProp as keyof CSSProperties]
		if(subVal == null) continue
		
		const slot = atRulePrefix ? `${atRulePrefix}|${suffix}|${subProp}` : `${suffix}|${subProp}`
		classes.push(
			getOrInsertAtom(slot, subVal, (cls) =>
				atRulePrefix
				? `${atRulePrefix}{.${cls}${suffix}{${subProp}:${subVal}}}`
				: `.${cls}${suffix}{${subProp}:${subVal}}`,
			),
		)
	}
}

const _collectBlock = (
	block: NestedBlock,
	classes: string[],
	atRulePrefix = "",
): void => {
	for(const prop in block) {
		const val = block[prop as keyof NestedBlock]
		if(val == null) continue
		
		if(prop.startsWith("&") && typeof val === "object") {
			_collectPseudo(prop.slice(1), val as CSSProperties, classes, atRulePrefix)
			continue
		}
		
		const slot = atRulePrefix ? `${atRulePrefix}|${prop}` : prop
		const scalarVal = val as string | number
		classes.push(
			getOrInsertAtom(slot, scalarVal, (cls) =>
				atRulePrefix
				? `${atRulePrefix}{.${cls}{${prop}:${scalarVal}}}`
				: `.${cls}{${prop}:${scalarVal}}`,
			),
		)
	}
}


/**
 * @param {Record<T, StyleRule>} styles
 * @returns {Record<T, string>}
 * @example
 * ```ts
 * export const theme = createTokens({
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
export const createStyleSheet = <T extends string>(styles: Record<T, StyleRule>): Record<T, string> => {
	const result = {} as Record<T, string>
	
	for(const key in styles) {
		const ruleBlock = styles[key]
		const classes: string[] = []
		
		for(const prop in ruleBlock) {
			const val = ruleBlock[prop as keyof StyleRule]
			if(val == null) continue
			
			if(prop.startsWith("@") && typeof val === "object") {
				_collectBlock(val as NestedBlock, classes, prop)
				continue
			}
			
			if(prop.startsWith("&") && typeof val === "object") {
				_collectPseudo(prop.slice(1), val as CSSProperties, classes)
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
