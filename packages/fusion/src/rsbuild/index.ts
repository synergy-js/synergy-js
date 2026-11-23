import { type RsbuildPlugin } from "rstack/app"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { useServerFnMiddleware } from "../common/middleware.ts"
import { PluginOptions } from "../common/types.ts"
import { FusionSeverGeneratorPlugin } from "./plugins/server-generator.ts"

const filename = fileURLToPath(import.meta.url)

const localDirectory = dirname(filename)

export const fusionPlugin = (options: PluginOptions): RsbuildPlugin => ({
	name: "fusion",
	enforce: "pre",
	setup({onBeforeStartDevServer, modifyRspackConfig, context}) {
		modifyRspackConfig(({module, plugins}) => {
			module = module || {}
			module.rules = module.rules || []
			
			const fusionLoaderPath = resolve(
				localDirectory,
				"loaders",
				"fusion-loader.js",
			)
			
			module.rules.push({
				test: /\.server\.ts$/,
				exclude: /node_modules/,
				enforce: "pre",
				use: [
					{
						loader: fusionLoaderPath,
						options: options,
					},
				],
			})
			plugins.push(
				new FusionSeverGeneratorPlugin(localDirectory, context, options),
				// new rspack.container.ModuleFederationPlugin({
				// 	name: "templates",
				// 	remotes: {
				// 		"bun": "https://fusion-s3.mpaynesecurity.net/bun.js",
				// 	},
				// }),
			)
		})
		
		onBeforeStartDevServer(({server}) => {
			useServerFnMiddleware(server.middlewares, "/fusion/rpc")
		})
	},
})
