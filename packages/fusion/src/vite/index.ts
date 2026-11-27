import type { IncomingMessage, ServerResponse } from "node:http"
import { resolve } from "node:path"
import { URL } from "node:url"
import type { Plugin, UserConfig } from "vite"
import { parseFns } from "../common/utils.ts"

const serverTemplatePath = resolve(
	import.meta.url,
	"templates",
	"serverEngine.js",
)

export function fusionPlugin(): Plugin {
	return {
		name: "vite-plugin-fusion",
		enforce: "pre",
		
		// 1. CONFIGURATION: Clean layout initialization. No inputs to declare!
		config(c: UserConfig) {
			c.environments = {
				...c.environments,
				server: {
					resolve: {
						// Tells Rolldown/Vite to leave native Node/Bun modules completely intact,
						// disabling the browser-shim pass for the server environment module graph!
						//noExternal: true,
					},
					build: {
						ssr: true,
						outDir: "dist/server",
						minify: true,
						rolldownOptions: {
							output: {
								format: "es",
								// Forces Rolldown to name the output file after the original file!
								// Your "/src/getHomeDir.server.ts" file outputs as "getHomeDir.js"
								entryFileNames: "[name].js",
								generatedCode: {
									preset: "es2015", // Strips out legacy 'var' statements completely
									symbols: true,
								},
							},
						},
					},
				},
			}
		},
		
		// 2. THE MULTI-ENVIRONMENT ORCHESTRATOR: Forces Vite to bundle your server target to disk
		// This top-level plugin hook natively intercepts the application 'vite build' process.
		async buildApp(builder) {
			// Step A: Build the default client environment first (frontend)
			const clientEnv = builder.environments.client
			if(clientEnv) {
				await builder.build(clientEnv)
			}
			
			// Step B: Build your isolated server environment immediately after (backend)
			const serverEnv = builder.environments.server
			if(serverEnv) {
				// Explicitly command Rolldown to compile and write your server chunk assets directly to disk!
				// This completely avoids the recursive infinite loop crash.
				await builder.build(serverEnv)
			}
		},
		
		// 3. STATELESS TRANSFORMATION
		transform(code: string, id: string) {
			if(this.environment?.name === "server") {
				return null
			}
			
			const [cleanPath] = id.split("?")
			if(!cleanPath.endsWith(".server.ts")) {
				return null
			}
			
			const isBuildMode = this.environment?.config.command === "build"
			
			// Calculate a clean unique baseline file ID string using its name
			const baseName =
				cleanPath.split("/").pop()?.replace(".server.ts", "") || "index"
			
			const clientSource: string[] = []
			const {exportedFns} = parseFns(cleanPath, code)
			
			for(const exportedFn of exportedFns) {
				// Production routes use the predictable file base name contract string
				const fnUrl = isBuildMode
				              ? `/fusion/rpc?file=${baseName}&method=${exportedFn}`
				              : `/fusion/rpc?file=${encodeURIComponent(cleanPath)}&method=${exportedFn}`
				
				clientSource.push(`
          export const ${exportedFn} = (...args) => {
            return fetch("${fnUrl}", {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify(args)
            }).then(r => r.json()).then(d => d.result)
          }
        `)
			}
			
			return {
				code: clientSource.join("\n"),
				map: null,
				moduleType: "js",
			}
		},
		
		// 4. DEVELOPMENT INTERCEPT ROUTER: Fully stateless local process evaluation
		configureServer(server) {
			server.middlewares.use(
				async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
					const parsedUrl = new URL(
						req.url || "",
						`http://${req.headers.host || "localhost"}`,
					)
					if(parsedUrl.pathname !== "/fusion/rpc" || req.method !== "POST") {
						return next()
					}
					
					try {
						const filePath = parsedUrl.searchParams.get("file")
						const targetMethod = parsedUrl.searchParams.get("method")
						if(!filePath || !targetMethod) {
							res.statusCode = 400
							return res.end("Missing required routing parameters.")
						}
						
						const serverEnv = server.environments.server
						// Safely type check the runner instance natively
						if(
							serverEnv &&
							"runner" in serverEnv &&
							(serverEnv as any).runner
						) {
							const nativeModule = await (serverEnv as any).runner.import(
								filePath,
							)
							
							let body = ""
							for await (const chunk of req) {
								body += chunk
							}
							const args = JSON.parse(body || "[]")
							const result = await nativeModule[targetMethod](...args)
							
							res.writeHead(200, {"Content-Type": "application/json"})
							return res.end(JSON.stringify({result}))
						}
						
						return next()
					}
					catch(err: any) {
						res.writeHead(500, {"Content-Type": "application/json"})
						return res.end(JSON.stringify({error: {message: err.message}}))
					}
				},
			)
		},
	}
}
