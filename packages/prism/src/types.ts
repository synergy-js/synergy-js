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

export type NestedBlock = CSSProperties & { [K in PseudoSelector]?: CSSProperties }
export type StyleRule = NestedBlock & {[atRule: `@${string}`]: NestedBlock}

export type TokenContract = Record<string, Record<string, string | number>>
export type TokenRefs<TTokens extends TokenContract> = {
	[K in keyof TTokens]: { [P in keyof TTokens[K]]: string }
}
export type ThemeOverrides<TTokens extends TokenContract> = {
	[K in keyof TTokens]?: { [P in keyof TTokens[K]]?: string | number }
}

export type VariantSchema = Record<string, Record<string, StyleRule>>
export type VariantSelection<TVariants extends VariantSchema> = {
	[K in keyof TVariants]?: keyof TVariants[K]
}

export interface RecipeConfig<TVariants extends VariantSchema> {
	base?: StyleRule
	variants: TVariants
	defaultVariants?: VariantSelection<TVariants>
}

export type RecipeProps<TVariants extends VariantSchema> = VariantSelection<TVariants> & {
	class?: string
}
export type VariantOf<T> = T extends (props?: infer P) => string ? NonNullable<P> : never
