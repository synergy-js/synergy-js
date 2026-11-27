let atomId = 0
let themeId = 0

export const atomCache: Map<string, string> = new Map<string, string>()   // "background-color:red" -> "prism-0"
export const classToSlot: Map<string, string> = new Map<string, string>() // "prism-0" -> "background-color"

export const sheet: CSSStyleSheet = new CSSStyleSheet()
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]

export const nextThemeClass = (): string => `prism-theme-${(themeId++).toString(36)}`

export const insertRule = (rule: string): void => {
	sheet.insertRule(rule, sheet.cssRules.length)
}

export const getOrInsertAtom = (
	slot: string,
	value: string | number,
	buildRule: (className: string) => string,
): string => {
	const cacheKey = `${slot}:${value}`
	let className = atomCache.get(cacheKey)
	
	if(!className) {
		className = `prism-${(atomId++).toString(36)}`
		atomCache.set(cacheKey, className)
		classToSlot.set(className, slot)
		insertRule(buildRule(className))
	}
	
	return className
}
