import { describe, expect, test } from "rstack/test"

// Lightweight CSSOM shim before importing `@synergy-js/css` (since `sheet.ts` initializes at module load)
interface MockRule {
	cssText: string
}

class MockCSSStyleSheet {
	cssRules: MockRule[] = []
	
	insertRule(rule: string, index = this.cssRules.length): number {
		this.cssRules.splice(index, 0, {cssText: rule})
		return index
	}
}

const globalRecord = globalThis as unknown as Record<string, unknown>
globalRecord.CSSStyleSheet = MockCSSStyleSheet
globalRecord.document = {adoptedStyleSheets: [] as MockCSSStyleSheet[]}

// Dynamic import after shim is attached
const {createStyleSheet, cx, defineTokens, createTheme, createVariants} = await import("../src/index.js")
const {sheet} = await import("../src/sheet.js")

const getInsertedRules = (): string[] =>
	Array.from(sheet.cssRules).map((r) => r.cssText)

describe("@synergy-js/css", () => {
	test("attaches constructable CSSStyleSheet to document.adoptedStyleSheets", () => {
		const adopted = (document as unknown as {adoptedStyleSheets: unknown[]}).adoptedStyleSheets
		expect(adopted).toContain(sheet)
	})
	
	test("createStyleSheet generates atomic classes and deduplicates identical declarations", () => {
		const countBefore = sheet.cssRules.length
		
		const s1 = createStyleSheet({
			boxA: {
				display: "flex",
				"background-color": "#111111",
			},
			boxB: {
				display: "flex",
				color: "#ffffff",
			},
		})
		
		const [flexA, bgA] = s1.boxA.split(" ")
		const [flexB, colorB] = s1.boxB.split(" ")
		
		// `display: flex` must share the exact same atomic class
		expect(flexA).toBe(flexB)
		expect(bgA).not.toBe(colorB)
		
		// Only 3 unique rules inserted (`display:flex`, `background-color:#111111`, `color:#ffffff`)
		expect(sheet.cssRules.length - countBefore).toBe(3)
		
		const rules = getInsertedRules()
		expect(rules).toContain(`.${flexA}{display:flex}`)
		expect(rules).toContain(`.${bgA}{background-color:#111111}`)
		expect(rules).toContain(`.${colorB}{color:#ffffff}`)
	})
	
	test("supports pseudo-selectors (&:hover, &:focus-visible) and descendant selectors (& > span)", () => {
		const styles = createStyleSheet({
			btn: {
				"background-color": "blue",
				"&:hover": {
					"background-color": "darkblue",
				},
				"& > span": {
					"font-weight": 700,
				},
			},
		})
		
		const [baseCls, hoverCls, childCls] = styles.btn.split(" ")
		const rules = getInsertedRules()
		
		expect(rules).toContain(`.${baseCls}{background-color:blue}`)
		expect(rules).toContain(`.${hoverCls}:hover{background-color:darkblue}`)
		expect(rules).toContain(`.${childCls} > span{font-weight:700}`)
	})
	
	test("supports @media rules and nested &:hover inside @media", () => {
		const styles = createStyleSheet({
			responsive: {
				padding: "8px",
				"@media (min-width: 768px)": {
					padding: "24px",
					"&:hover": {
						"background-color": "rebeccapurple",
					},
				},
			},
		})
		
		const [basePad, mediaPad, mediaHover] = styles.responsive.split(" ")
		const rules = getInsertedRules()
		
		expect(rules).toContain(`.${basePad}{padding:8px}`)
		expect(rules).toContain(`@media (min-width: 768px){.${mediaPad}{padding:24px}}`)
		expect(rules).toContain(`@media (min-width: 768px){.${mediaHover}:hover{background-color:rebeccapurple}}`)
	})
	
	test("cx() enforces deterministic last-wins overrides regardless of stylesheet insertion order", () => {
		// Insert `override` FIRST in stylesheet order
		const first = createStyleSheet({
			override: {
				"background-color": "crimson",
				"&:hover": {"background-color": "darkred"},
			},
		})
		
		// Insert `base` SECOND in stylesheet order
		const second = createStyleSheet({
			base: {
				"background-color": "royalblue",
				color: "white",
				"&:hover": {"background-color": "navy"},
			},
		})
		
		// Even though `override` was inserted earlier, passing it last in cx() strips `base`'s conflicting classes
		const merged = cx(second.base, false, null, undefined, first.override, "external-utility")
		const tokens = merged.split(" ")
		
		const [overrideBg, overrideHoverBg] = first.override.split(" ")
		const [baseBg, baseColor, baseHoverBg] = second.base.split(" ")
		
		expect(tokens).toContain("external-utility")
		expect(tokens).toContain(baseColor!)
		expect(tokens).toContain(overrideBg!)
		expect(tokens).toContain(overrideHoverBg!)
		expect(tokens).not.toContain(baseBg!)
		expect(tokens).not.toContain(baseHoverBg!)
	})
	
	test("defineTokens() injects :root CSS variables and returns typed var(--syn-...) references", () => {
		const tokens = defineTokens({
			colors: {
				surface: "#ffffff",
				text: "#09090b",
			},
			space: {
				md: "16px",
			},
		})
		
		expect(tokens.colors.surface).toBe("var(--syn-colors-surface)")
		expect(tokens.colors.text).toBe("var(--syn-colors-text)")
		expect(tokens.space.md).toBe("var(--syn-space-md)")
		
		const rules = getInsertedRules()
		expect(rules).toContain(":root{--syn-colors-surface:#ffffff;--syn-colors-text:#09090b;--syn-space-md:16px}")
	})
	
	test("createTheme() injects scoped .syn-theme-* variable overrides and returns the theme class", () => {
		const tokens = defineTokens({
			palette: {
				bg: "#fafafa",
				fg: "#18181b",
			},
		})
		
		const darkClass = createTheme(tokens, {
			palette: {
				bg: "#09090b",
			},
		})
		
		expect(darkClass).toMatch(/^syn-theme-[0-9a-z]+$/)
		const rules = getInsertedRules()
		expect(rules).toContain(`.${darkClass}{--syn-palette-bg:#09090b}`)
	})
	
	test("createVariants() applies base, defaultVariants, selected variants, and class overrides via cx()", () => {
		const button = createVariants({
			base: {
				display: "inline-flex",
				"background-color": "gray",
				padding: "6px 12px",
			},
			variants: {
				tone: {
					primary: {"background-color": "dodgerblue"},
					danger: {"background-color": "tomato"},
				},
				size: {
					sm: {padding: "4px 8px"},
					lg: {padding: "12px 24px"},
				},
			},
			defaultVariants: {
				tone: "primary",
				size: "sm",
			},
		})
		
		const primarySm = createStyleSheet({r: {"background-color": "dodgerblue", padding: "4px 8px"}}).r.split(" ")
		const dangerLg = createStyleSheet({r: {"background-color": "tomato", padding: "12px 24px"}}).r.split(" ")
		const customPad = createStyleSheet({r: {padding: "99px"}}).r
		
		// Default variants win over base
		const defaultClasses = button().split(" ")
		expect(defaultClasses).toContain(primarySm[0]!)
		expect(defaultClasses).toContain(primarySm[1]!)
		
		// Explicit variants win over defaultVariants
		const dangerClasses = button({tone: "danger", size: "lg"}).split(" ")
		expect(dangerClasses).toContain(dangerLg[0]!)
		expect(dangerClasses).toContain(dangerLg[1]!)
		expect(dangerClasses).not.toContain(primarySm[0]!)
		
		// Explicit `class` prop wins over variant slot
		const customClasses = button({size: "lg", class: customPad}).split(" ")
		expect(customClasses).toContain(customPad)
		expect(customClasses).not.toContain(dangerLg[1]!)
	})
})
