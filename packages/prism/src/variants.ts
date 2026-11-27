import { cx } from "./cx.js"
import { createStyleSheet } from "./stylesheet.js"
import type { RecipeConfig, RecipeProps, VariantSchema } from "./types.ts"


/**
 *
 * @param {RecipeConfig<TVariants>} config
 * @returns {(props?: RecipeProps<TVariants>) => string}
 * @example
 * ```ts
 * const button = createVariants({
 * 	base: {
 * 		display: "inline-flex",
 * 		"align-items": "center",
 * 		"border-radius": "6px",
 * 		"font-weight": 500,
 * 		cursor: "pointer",
 * 	},
 * 	variants: {
 * 		tone: {
 * 			primary: {
 * 				"background-color": "#2563eb",
 * 				color: "#ffffff",
 * 				"&:hover": { "background-color": "#1d4ed8" },
 * 			},
 * 			danger: {
 * 				"background-color": "#dc2626",
 * 				color: "#ffffff",
 * 				"&:hover": { "background-color": "#b91c1c" },
 * 			},
 * 		},
 * 		size: {
 * 			sm: { padding: "4px 10px", "font-size": "13px" },
 * 			lg: { padding: "10px 20px", "font-size": "16px" },
 * 		},
 * 	},
 * 	defaultVariants: {
 * 		tone: "primary",
 * 		size: "sm",
 * 	},
 * })
 *
 * // Usage in JSX — TypeScript autocompletes `tone: "primary" | "danger"` and `size: "sm" | "lg"`:
 * <button class={button({ tone: "danger", size: "lg" })}>Delete</button>
 * <button class={button({ class: styles.extraMargin })}>Default Primary Sm</button>
 * ```
 */
export const createVariants = <TVariants extends VariantSchema>(config: RecipeConfig<TVariants>): ((props?: RecipeProps<TVariants>) => string) => {
	const baseClass = config.base ? createStyleSheet({base: config.base}).base : ""
	const compiledVariants = {} as { [K in keyof TVariants]: Record<string, string> }
	
	for(const group in config.variants) {
		compiledVariants[group] = createStyleSheet(config.variants[group]!)
	}
	
	return (props?: RecipeProps<TVariants>): string => {
		const chunks: (string | undefined)[] = [baseClass]
		
		for(const group in compiledVariants) {
			const selected = props?.[group] ?? config.defaultVariants?.[group]
			if(selected != null) {
				chunks.push(compiledVariants[group]![selected as string])
			}
		}
		
		if(props?.class) {
			chunks.push(props.class)
		}
		
		return cx(...chunks)
	}
}
