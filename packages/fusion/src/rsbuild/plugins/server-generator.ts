import { type RsbuildContext, type Rspack, rspack } from "@rsbuild/core"
import MagicString from "magic-string"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createHash } from "node:crypto"
import {
	type FusionServerFunctionMetadata,
	type PluginOptions,
} from "../../common/types.ts"
import { parseServerFunctionStubs } from "../../common/utils.ts"
import { colors, log } from "@synergy-js/scribe"

/**
 * Rspack plugin to generate the production index.js server entry
 * */
export class FusionSeverGeneratorPlugin {
	private readonly _name = "Fusion Sever Generator Plugin"
	
	private readonly _templateDirectory: string
	
	private readonly _context: RsbuildContext
	
	private readonly _options: PluginOptions
	
	constructor(
		templateDirectory: string,
		context: RsbuildContext,
		options: PluginOptions,
	) {
		this._templateDirectory = templateDirectory
		this._context = context
		this._options = options
	}
	
	apply(compiler: Rspack.Compiler): void {
		const {RawSource} = compiler.rspack.sources
		const {preset, logLevel} = this._options
		
		compiler.hooks.thisCompilation.tap(
			this._name,
			(compilation: Rspack.Compilation) => {
				compilation.hooks.processAssets.tap(
					{
						name: this._name,
						stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
					},
					() => {
						const serverFns = this.generateServerManifestImports(
							this._context,
							compilation,
						)
						
						
						const serverTemplateFilePath = resolve(
							this._templateDirectory,
							"../common",
							"templates",
							`${preset}.js`,
						)
						
						if(!existsSync(serverTemplateFilePath)) {
							log.badge(
								`[${this._name}]`,
								`Template file missing at ${serverTemplateFilePath}`,
							)
							process.exit(1)
						}
						
						if(logLevel === "verbose" && this._context.action === "build") {
							log.badge(
								colors.bold("\nUsing"),
								colors.cyan(`\n${serverTemplateFilePath}\n`),
							)
						}
						
						const serverTemplate = readFileSync(
							serverTemplateFilePath,
							"utf-8",
						)
						const msServerTemplate = new MagicString(serverTemplate)
						
						if(typeof serverFns === "string") {
							msServerTemplate.prepend(serverFns)
						}
						
						compilation.emitAsset(
							"index.js",
							new RawSource(msServerTemplate.toString()),
						)
						
						if(logLevel === "verbose") {
							log.info(`Wrote server entry point to ${this._context.distPath}`)
						}
					},
				)
			},
		)
	}
	
	private generateServerManifestImports(context: RsbuildContext, compilation: Rspack.Compilation): string {
		const {logLevel} = this._options
		
		if(context.action !== "build") {
			return ""
		}
		
		const prodDistPath = context.distPath
		const serverFnOutputDir = `${prodDistPath}/server-fn`
		
		mkdirSync(serverFnOutputDir, {recursive: true})
		
		// Use a clean, isolated MagicString instance container local strictly to this execution pass execution
		const msImports = new MagicString("")
		const productionFunctions = new Map<string, Map<string, FusionServerFunctionMetadata>>()
		for(const module of compilation.modules) {
			if(!("resource" in module) || typeof module.resource !== "string") {
				continue
			}

			const sourcePath = module.resource.split(/[?#]/, 1)[0]
			if(!sourcePath.endsWith(".server.ts")) {
				continue
			}

			const moduleSource = module.originalSource()
			if(moduleSource) {
				for(const fn of parseServerFunctionStubs(sourcePath, moduleSource.source().toString())) {
					let fileFunctions = productionFunctions.get(sourcePath)
					if(!fileFunctions) {
						fileFunctions = new Map()
						productionFunctions.set(sourcePath, fileFunctions)
					}
					fileFunctions.set(fn.id, fn)
				}
			}
		}

		if(productionFunctions.size === 0) {
			console.error("Did not find any functions")
			process.exit(1)
		}
		
		for(const [srcFilePath, fileFunctions] of productionFunctions) {
			const serverFn = readFileSync(srcFilePath, "utf-8")
			const moduleId = createHash("sha256").update(srcFilePath).digest("hex").slice(0, 12)
			const moduleName = `serverModule_${moduleId}`
			
			if(logLevel === "verbose") {
				log.info(`Generating server manifest for ${srcFilePath}`)
			}
			
			const transpiledServerFn = rspack.experiments.swc.transformSync(
				serverFn,
				{
					filename: srcFilePath,
					jsc: {
						parser: {
							syntax: "typescript",
						},
						target: "esnext",
						transform: {
							optimizer: {
								simplify: false,
							},
						},
						minify: {
							mangle: false,
						},
						experimental: {
							keepImportAssertions: true,
						},
						keepClassNames: true,
					},
					module: {
						type: "nodenext",
					},
				},
			).code
			
			const assetPath = `server-fn/${moduleId}.js`
			compilation.emitAsset(assetPath, new rspack.sources.RawSource(transpiledServerFn))
			
			if(logLevel === "verbose") {
				log.info(`Wrote ${assetPath} to ${serverFnOutputDir}`)
			}
			
			msImports.append(`import * as ${moduleName} from "./${assetPath}"\n`)
			for(const {id, method} of fileFunctions.values()) {
				msImports.append(
					`serverFns.set(${JSON.stringify(id)}, ${moduleName}[${JSON.stringify(method)}])\n`,
				)
			}
		}
		msImports.prepend(`let serverFns = new Map()\n`)
		return msImports.toString()
	}
}
