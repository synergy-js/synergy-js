import { log } from "@synergy-js/scribe"
import type { Rspack } from "rstack/app"
import type { PluginOptions } from "../../common/types.ts"
import { generateHash, parseFns } from "../../common/utils.ts"

export default function fusionLoader(
	this: Rspack.LoaderContext<PluginOptions>,
	code: string,
): string | void {
	const filePath = this.resourcePath
	const isBuild = this.mode === "production"
	const {logLevel} = this.getOptions()
	
	// Generate a client-side file containing fetch endpoints
	const fileHash = generateHash(6)
	const clientSource: string[] = []
	
	const {exportedFns} = parseFns(filePath, code)
	
	for(const exportedFn of exportedFns) {
		const fnId = `fn_${fileHash}_${exportedFn}`
		
		// In Development: The client URL keeps local filepath: /fusion/rpc?id=...&file=...&method=...
		// In Production: The local filesystem path string is completely omitted from the source code, producing a safe, clean token contract: /fusion/rpc?id=...&method=....
		const fnUrl = isBuild
		              ? `/fusion/rpc?id=${fnId}&method=${exportedFn}`
		              : `/fusion/rpc?id=${fnId}&file=${encodeURIComponent(filePath)}&method=${exportedFn}`
		
		clientSource.push(`
			export const ${exportedFn} = (...args) => {
				return fetch("${fnUrl}", {
					method: "POST",
					headers: {"Content-Type": "application/json"},
					body: JSON.stringify(args)
				}).then(r => r.json()).then(d => d.result)
			}
		`)
		if(logLevel === "verbose" || logLevel === "debug") {
			log.badge(
				"[Loader]",
				`Registered ${fnId} for ${filePath}\n`,
			)
		}
	}

	// Send the client code down the pipeline
	return clientSource.join("\n")
}
