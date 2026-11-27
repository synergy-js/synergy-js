import { insertRule, nextThemeClass } from "./sheet.js"
import type { ThemeOverrides, TokenContract, TokenRefs } from "./types.js"

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
export const defineTokens = <TTokens extends TokenContract>(tokens: TTokens): TokenRefs<TTokens> => {
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
		insertRule(`:root{${vars.join(";")}}`)
	}
	
	return refs as TokenRefs<TTokens>
}

/**
 * @template TTokens
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
 * @param _tokens
 * @param overrides
 */
export const createTheme = <TTokens extends TokenContract>(
	_tokens: TokenRefs<TTokens>,
	overrides: ThemeOverrides<TTokens>,
): string => {
	const vars: string[] = []
	
	for(const group in overrides) {
		const groupOverrides = overrides[group]
		if(!groupOverrides) continue
		for(const token in groupOverrides) {
			const val = groupOverrides[token]
			if(val != null) {
				vars.push(`--syn-${group}-${token}:${val}`)
			}
		}
	}
	
	const themeClass = nextThemeClass()
	if(vars.length > 0) {
		insertRule(`.${themeClass}{${vars.join(";")}}`)
	}
	
	return themeClass
}
