import { type RsbuildContext, type Rspack, rspack } from "@rsbuild/core"
import MagicString from "magic-string"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { PluginOptions, productionFnManifest } from "../../common/types.ts"
import { colors, log } from "../../common/utils.ts"

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
							productionFnManifest,
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
							log.withErrorWithBadge(
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
	
	private generateServerManifestImports(
		productionFnManifest: Map<string, string>,
		context: RsbuildContext,
		compilation: Rspack.Compilation,
	): string {
		const {logLevel} = this._options
		
		if(context.action !== "build") {
			return ""
		}
		
		const prodDistPath = context.distPath
		const serverFnOutputDir = `${prodDistPath}/server-fn`
		
		mkdirSync(serverFnOutputDir, {recursive: true})
		
		// Use a clean, isolated MagicString instance container local strictly to this execution pass execution
		const msImports = new MagicString("")
		if(productionFnManifest.size === 0) {
			console.error("Did not find any functions")
			process.exit(1)
		}
		
		for(const [serverFnId, srcFilePath] of productionFnManifest.entries()) {
			const serverFn = readFileSync(srcFilePath, "utf-8")
			
			if(logLevel === "verbose") {
				log.info("Generating server manifest")
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
			
			// Create a separate, localized variable snapshot container for this iteration loop pass
			const currentFnId = String(serverFnId)
			const msServerFnId = new MagicString(currentFnId)
			
			const hashEndIndex = currentFnId.lastIndexOf("_")
			msServerFnId.remove(0, hashEndIndex + 1)
			
			
			compilation.emitAsset(`server-fn/${msServerFnId.toString()}.js`, new rspack.sources.RawSource(transpiledServerFn))
			
			if(logLevel === "verbose") {
				log.info(`Wrote ${msServerFnId.toString()}.js to ${serverFnOutputDir}`)
			}
			
			// Append utilizing un-mutated string fields to prevent internal pointer duplication crashes
			msImports.prepend(
				`import {${msServerFnId.toString()}} from "./server-fn/${msServerFnId.toString()}"\nserverFns.set("${serverFnId}", ${msServerFnId.toString()})\n`,
			)
		}
		msImports.prepend(`let serverFns = new Map()\n`)
		return msImports.toString()
	}
}
