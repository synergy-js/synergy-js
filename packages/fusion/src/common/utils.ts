import { parseSync, Visitor, type Program } from "oxc-parser"
import { randomBytes } from "node:crypto"
import type { LiveLine, ServerModule } from "./types.ts"

/**
 * Generate a unique id (hash) for each rfunction
 * @returns {string}
 * @param length
 */
export const generateHash = (length: number): string => {
	return randomBytes(length)
		.toString("base64")
		.replace("/", "_")
		.replace("+", "-")
}

/**
 * @privateRemarks
 * We intercept files ending with .server.ts, completely strip its server-side execution code,
 * replace it with client-side fetch stubs so the browser doesn't break,
 * and update a global server-side registry (productionFnManifest / developmentFnManifest)
 * to map network calls back to the original files.
 * @param fileName
 * @param {string} code
 * @returns {{exportedFns: string[], result: Program}}
 *
 */
export const parseFns = (fileName: string, code: string): {exportedFns: string[], result: Program} => {
	
	const parseResult = parseSync(fileName, code, {
		sourceType: "module",
		lang: "ts", // Tells OXC to parse TypeScript syntax
	})
	
	const programAst = parseResult.program
	const exportedFns: string[] = []
	
	const visitor = new Visitor(({
		ExportNamedDeclaration(node) {
			const decl = node.declaration
			
			if(!decl) {
				return
			}
			// Extract function names from exports (e.g. export function myFn()
			if(decl.type === "FunctionDeclaration" && decl.id) {
				exportedFns.push(decl.id.name)
			}
			// Extract variable names from exports (e.g. export const myFn = ...)
			if(decl.type === "VariableDeclaration") {
				for(const declItem of decl.declarations) {
					if(declItem.id && declItem.id.type === "Identifier") {
						exportedFns.push(declItem.id.name)
					}
				}
			}
		},
	}))
	visitor.visit(programAst)
	
	return {
		exportedFns,
		result: programAst,
	}
	
	
}
// export const parseFns = (code: string): ParseResult => {
//
// 	// Extend the Acorn parser using the Typescript extension from Svelte
// 	const tsParser = Parser.extend(tsPlugin())
//
// 	const programAst = tsParser.parse(code, {
// 		sourceType: "module",
// 		ecmaVersion: "latest",
// 		locations: true,
// 	}) as Program
//
// 	const state: VisitorState = {
// 		exportedFns: [],
// 	}
//
// 	const node: Node = programAst
//
// 	const visitors: Visitors<Node, VisitorState> = {
// 		// 1. Hit the export wrapper first
// 		ExportNamedDeclaration(_node, context) {
// 			// Tell the walker to dive INSIDE the export statement to check the actual declaration
// 			context.next()
// 		},
// 		// 2. This fires for ANY function declaration (including exported ones) e.g export function myFn() {}
// 		FunctionDeclaration({id}, {path, state}) {
// 			// Check path history to see if the parent is an export
// 			const parent = path.at(-1)
//
// 			if(parent && parent.type === "ExportNamedDeclaration" && id) {
// 				state.exportedFns.push(id.name)
// 			}
// 		},
// 		// 3. This fires for ANY variable declaration (including exported ones) e.g. export const myFn = () => {}
// 		VariableDeclaration({declarations}, {state, path}) {
// 			const parent = path.at(-1)
//
// 			if(parent && parent.type === "ExportNamedDeclaration") {
// 				for(const decl of declarations) {
// 					if(decl.id && decl.id.type === "Identifier") {
// 						state.exportedFns.push(decl.id.name)
// 					}
// 				}
// 			}
// 		},
// 	}
//
// 	walk(node, state, visitors)
//
// 	return {
// 		exportedFns: state.exportedFns,
// 		result: programAst,
// 	}
// }

/**
 *
 * @param {Request} request
 * @param {string} filePath
 * @param {string} targetMethod
 * @returns {Promise<Response>}
 */
export const useDevServerFnHandler = async (request: Request, filePath: string, targetMethod: string): Promise<Response> => {
	try {
		const args = (await request.json()) as unknown[]
		
		const serverModule = (await import(filePath)) as ServerModule
		
		const targetFunction = serverModule[targetMethod]
		
		if(typeof targetFunction !== "function") {
			return Response.json(
				{
					error: {
						message: `Export '${targetMethod}' in ${filePath} is not an executable function.`,
					},
				},
				{status: 500},
			)
		}
		
		const result = await targetFunction(...args)
		
		// Pure standard Response object mapping
		return Response.json({result})
	}
	catch(err: unknown) {
		const errorInstance = err as Error
		return Response.json(
			{error: {message: errorInstance?.message || String(err)}},
			{status: 500},
		)
	}
}

// Terminal Control Characters (ANSI Escape Sequences)
const ESC = "\x1b["
const RESET = `${ESC}0m`
const MOVE_TO_START = "\r"
const CLEAR_LINE = "\x1b[2K" // Completely erases the current line so long text doesn't bleed

// 1. The Strict, Expanded Interface Strategy
export interface ColorFormatter {
	(text: string | number): string
	
	// Styles & Modifiers
	get bold(): ColorFormatter
	
	get dim(): ColorFormatter
	
	get italic(): ColorFormatter
	
	get underline(): ColorFormatter
	
	// Foreground Colors
	get red(): ColorFormatter
	
	get green(): ColorFormatter
	
	get yellow(): ColorFormatter
	
	get blue(): ColorFormatter
	
	get magenta(): ColorFormatter
	
	get cyan(): ColorFormatter
	
	get gray(): ColorFormatter
	
	// Background Colors (New Expansion 🚀)
	get bgRed(): ColorFormatter
	
	get bgGreen(): ColorFormatter
	
	get bgYellow(): ColorFormatter
	
	get bgBlue(): ColorFormatter
	
	get bgMagenta(): ColorFormatter
	
	get bgCyan(): ColorFormatter
}

// 2. Clear, grouped mapping lookup tables
const codes = {
	bold: 1,
	dim: 2,
	italic: 3,
	underline: 4,
	red: 31,
	green: 32,
	yellow: 33,
	blue: 34,
	magenta: 35,
	cyan: 96,
	gray: 90,
	bgRed: 41,
	bgGreen: 42,
	bgYellow: 43,
	bgBlue: 44,
	bgMagenta: 45,
	bgCyan: 46,
} as const

type ColorKey = keyof typeof codes

function createFormatter(currentCodes: readonly number[] = []): ColorFormatter {
	// 1. The base function that handles the string mapping execution
	const targetFn = (text: string | number): string => {
		if(currentCodes.length === 0) return String(text)
		return `${ESC}${currentCodes.join("")}m${text}${RESET}`
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
	success: (msg: string): void =>
		console.log(`${colors.bold.green("success")} ${msg}`),
	error: (msg: string): void =>
		console.error(`${colors.bold.red("error")}   ${msg}`),
	info: (msg: string): void =>
		console.log(`${colors.bold.cyan("info")}    ${msg}`),
	warn: (msg: string): void =>
		console.warn(`${colors.bold.yellow("warn")}    ${msg}`),
	badge: (label: string, text: string): void =>
		console.log(`\n${colors.bold.bgBlue.cyan(` ${label}::Error `)} ${text}\n`),
	withErrorWithBadge: (label: string, text: string): void =>
		console.log(`${colors.bold.red(` ${label} `)} ${text}`),
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
