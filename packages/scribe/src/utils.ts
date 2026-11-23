import { CLEAR_LINE, codes, type ColorFormatter, type ColorKey, ESC, type LiveLine, MOVE_TO_START, RESET } from "./types.ts"

const createFormatter = (
	currentCodes: readonly number[] = [],
): ColorFormatter => {
	// 1. The base function that handles the string mapping execution
	const targetFn = (text: string | number): string => {
		if(currentCodes.length === 0) return String(text)
		return `${ESC}${currentCodes.join(";")}m${text}${RESET}`
	}
	
	// 2. Wrap it in a Proxy to dynamically catch chained lookups on EVERY link
	const proxy = new Proxy(targetFn, {
		get(target, prop: string) {
			// If the property exists in our ANSI lookup codes table, extend the chain
			if(prop in codes) {
				return createFormatter([...currentCodes, codes[prop as ColorKey]])
			}
			// Fall back to native function methods (like .toString, .apply, etc)
			return Reflect.get(target, prop)
		},
	})
	
	return proxy as unknown as ColorFormatter
}

export const colors: ColorFormatter = createFormatter()

// 4. Clean, Prefabricated CLI Status Logger Layouts (New Expansion 🚀)
export const log = {
	success: (msg: string): void => console.log(`${colors.bold.green("success")} ${msg}`),
	error: (msg: string): void => console.error(`${colors.bold.red("error")}   ${msg}`),
	info: (msg: string): void => console.log(`${colors.bold.cyan("info")}    ${msg}`),
	warn: (msg: string): void => console.warn(`${colors.bold.yellow("warn")}    ${msg}`),
	badge: (label: string, text: string): void => console.log(`${colors.bold.bgBlue.cyan(` ${label} `)} ${text}`),
	live(): LiveLine {
		return {
			update(text: string) {
				// Move to start, wipe any old text, and write the new text without a newline
				process.stdout.write(`${MOVE_TO_START}${CLEAR_LINE}${text}`)
			},
			done(finalText?: string) {
				if(finalText) {
					// If a final string is provided, overwrite the line one last time
					process.stdout.write(`${MOVE_TO_START}${CLEAR_LINE}${finalText}\n`)
				}
				else {
					// Otherwise, just move safely to the next line so future logs don't overwrite it
					process.stdout.write("\n")
				}
			},
		}
	},
}
