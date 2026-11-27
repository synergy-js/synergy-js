import { describe, expect, it } from "rstack/test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import fusionLoader from "../src/rsbuild/loaders/fusion-loader.ts"
import { FusionSeverGeneratorPlugin } from "../src/rsbuild/plugins/server-generator.ts"
import {
	generateHash,
	parseFns,
	parseServerFunctionStubs,
	useDevServerFnHandler,
} from "../src/common/utils.ts"

const fixturePath = new URL("./fixtures/server-functions.ts", import.meta.url).href
const multiExportFixturePath = fileURLToPath(
	new URL("./fixtures/multi.server.ts", import.meta.url),
)

describe("Fusion utilities", () => {
	it("generates URL-safe function hashes", () => {
		const hash = generateHash(6)
		
		expect(hash.length).toBe(8)
		expect(/[+/]/.test(hash)).toBe(false)
	})
	
	it("discovers exported functions and variables only", () => {
		const code = `
			const privateFn = () => {}
			export function namedFunction() {}
			export const namedValue = 1, anotherValue = 2
			export default function defaultFunction() {}
			export { privateFn }
		`
		
		const {exportedFns} = parseFns("/src/example.server.ts", code)
		
		expect(exportedFns).toEqual(["namedFunction", "namedValue", "anotherValue"])
	})
	
	it("extracts production function IDs from transformed module stubs", () => {
		const functions = parseServerFunctionStubs(
			"/src/example.server.ts",
			"export const add = (...args) => fetch(\"/fusion/rpc?id=fn_abc_add&method=add\")",
		)
		
		expect(functions).toEqual([
			{id: "fn_abc_add", method: "add", sourcePath: "/src/example.server.ts"},
		])
	})
	
	it("extracts every server stub from a multi-export module", () => {
		const functions = parseServerFunctionStubs(
			"/src/example.server.ts",
			[
				"export const add = (...args) => fetch(\"/fusion/rpc?id=fn_abc_add&method=add\")",
				"export const multiply = (...args) => fetch(\"/fusion/rpc?id=fn_abc_multiply&method=multiply\")",
			].join("\n"),
		)
		
		expect(functions).toEqual([
			{id: "fn_abc_add", method: "add", sourcePath: "/src/example.server.ts"},
			{id: "fn_abc_multiply", method: "multiply", sourcePath: "/src/example.server.ts"},
		])
	})
	
	it("invokes a development server function and serializes its result", async () => {
		const response = await useDevServerFnHandler(
			new Request("http://localhost/fusion/rpc", {
				method: "POST",
				body: JSON.stringify([2, 3]),
			}),
			fixturePath,
			"add",
		)
		
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({result: 5})
	})
	
	it("returns an error when the requested export is not a function", async () => {
		const response = await useDevServerFnHandler(
			new Request("http://localhost/fusion/rpc", {
				method: "POST",
				body: JSON.stringify([]),
			}),
			fixturePath,
			"value",
		)
		
		expect(response.status).toBe(500)
		expect(await response.json()).toEqual({
			error: {
				message: `Export 'value' in ${fixturePath} is not an executable function.`,
			},
		})
	})
	
	it("returns an error when the server module cannot be imported", async () => {
		const response = await useDevServerFnHandler(
			new Request("http://localhost/fusion/rpc", {
				method: "POST",
				body: JSON.stringify([]),
			}),
			`${fixturePath}.missing`,
			"add",
		)
		
		expect(response.status).toBe(500)
		expect((await response.json()).error.message).toBeTruthy()
	})
})

describe("Fusion loader", () => {
	const sourcePath = "/src/example.server.ts"
	const source = `
		export function add(left: number, right: number) {
			return left + right
		}
	`
	
	it("replaces development exports with RPC stubs containing the source path", () => {
		const context = {
			resourcePath: sourcePath,
			mode: "development",
			getOptions: () => ({logLevel: "normal"}),
		}
		
		const output = fusionLoader.call(context as never, source) ?? ""
		
		expect(output).toContain("export const add")
		expect(output).toContain(
			`/fusion/rpc?id=fn_`,
		)
		expect(output).toContain(`&file=${encodeURIComponent(sourcePath)}&method=add`)
	})
	
	it("omits source paths from production stubs", () => {
		const context = {
			resourcePath: sourcePath,
			mode: "production",
			getOptions: () => ({logLevel: "normal"}),
		}
		
		const output = fusionLoader.call(context as never, source) ?? ""
		
		expect(output).toContain("/fusion/rpc?id=fn_")
		expect(output).toContain("&method=add")
		expect(output).not.toContain(sourcePath)
	})
	
	it("generates a client stub for every named server export", () => {
		const context = {
			resourcePath: sourcePath,
			mode: "development",
			getOptions: () => ({logLevel: "normal"}),
		}
		const output = fusionLoader.call(
			context as never,
			`
				export function add(left: number, right: number) {
					return left + right
				}
				export const multiply = (left: number, right: number) => left * right
				export const subtract = (left: number, right: number) => left - right
			`,
		) ?? ""
		
		expect(output.match(/export const /g)).toHaveLength(3)
		expect(output).toContain("&method=add")
		expect(output).toContain("&method=multiply")
		expect(output).toContain("&method=subtract")
	})
	
	it("generates one production server module with callable mappings for every export", () => {
		const clientSource = fusionLoader.call(
			{
				resourcePath: multiExportFixturePath,
				mode: "production",
				getOptions: () => ({logLevel: "normal"}),
			} as never,
			`
				export const add = (left: number, right: number) => left + right
				export const multiply = (left: number, right: number) => left * right
			`,
		) ?? ""
		const emittedAssets = new Map<string, string>()
		let captureCompilation: ((compilation: never) => void) | undefined
		let processAssets: (() => void) | undefined
		const compilation = {
			modules: [{
				resource: multiExportFixturePath,
				originalSource: () => ({source: () => clientSource}),
			},
			],
			hooks: {
				processAssets: {
					tap: (_options: unknown, callback: () => void) => {
						processAssets = callback
					},
				},
			},
			emitAsset: (name: string, source: {source: () => string}) => {
				emittedAssets.set(name, source.source())
			},
		}
		const compiler = {
			hooks: {
				thisCompilation: {
					tap: (_name: string, callback: (compilation: never) => void) => {
						captureCompilation = callback
					},
				},
			},
			rspack: {
				sources: {
					RawSource: class {
						private readonly value: string
						
						constructor(value: string) {
							this.value = value
						}
						
						source(): string {
							return this.value
						}
					},
				},
			},
			webpack: {Compilation: {PROCESS_ASSETS_STAGE_ADDITIONS: 0}},
		}
		const outputDirectory = mkdtempSync(resolve(tmpdir(), "fusion-multi-export-"))
		const pluginDirectory = fileURLToPath(new URL("../src/rsbuild", import.meta.url))
		const plugin = new FusionSeverGeneratorPlugin(
			pluginDirectory,
			{action: "build", distPath: outputDirectory} as never,
			{preset: "bun", logLevel: "normal"},
		)
		
		try {
			plugin.apply(compiler as never)
			captureCompilation?.(compilation as never)
			processAssets?.()
			
			const serverAssets = [...emittedAssets.keys()].filter((name) =>
				name.startsWith("server-fn/"),
			)
			expect(serverAssets).toHaveLength(1)
			const serverModule = emittedAssets.get(serverAssets[0]!)!
			const serverEntry = emittedAssets.get("index.js")!
			expect(serverModule).toContain("add")
			expect(serverModule).toContain("multiply")
			expect(serverEntry).toContain("[\"add\"]")
			expect(serverEntry).toContain("[\"multiply\"]")
			expect(serverEntry.match(/serverFns\.set\(/g)).toHaveLength(2)
		}
		finally {
			rmSync(outputDirectory, {recursive: true, force: true})
		}
	})
})

// describe("Fusion Vite plugin", () => {
// 	it("transforms development server modules into stubs with their source path", () => {
// 		const plugin = viteFusionPlugin()
// 		const transformed = plugin.transform?.call(
// 			{
// 				environment: {name: "client", config: {command: "serve"}},
// 			} as never,
// 			"export const greet = (name: string) => `Hello ${name}`",
// 			"/src/greeting.server.ts",
// 		)
//
// 		expect(transformed).not.toBeNull()
// 		expect(transformed?.code).toContain("export const greet")
// 		expect(transformed?.code).toContain(
// 			`file=${encodeURIComponent("/src/greeting.server.ts")}`,
// 		)
// 	})
//
// 	it("does not transform non-server files", () => {
// 		const plugin = viteFusionPlugin()
// 		const transformed = plugin.transform?.call(
// 			{
// 				environment: {name: "client", config: {command: "serve"}},
// 			} as never,
// 			"export const value = 1",
// 			"/src/example.ts",
// 		)
//
// 		expect(transformed).toBeNull()
// 	})
//
// 	it("uses a stable source basename for production RPC routing", () => {
// 		const plugin = viteFusionPlugin()
// 		const transformed = plugin.transform?.call(
// 			{
// 				environment: {name: "client", config: {command: "build"}},
// 			} as never,
// 			"export const greet = () => 'hello'",
// 			"/src/greeting.server.ts",
// 		)
//
// 		expect(transformed?.code).toContain("file=greeting")
// 		expect(transformed?.code).not.toContain("/src/greeting.server.ts")
// 	})
// })
