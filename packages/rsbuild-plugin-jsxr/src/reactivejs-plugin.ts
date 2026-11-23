import type { RsbuildPlugin } from "@rsbuild/core"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const filename = fileURLToPath(import.meta.url)

const localDirectory = dirname(filename)

export const ReactiveJSPlugin = (): RsbuildPlugin => ({
	name: "ReactiveJs Plugin",
	setup({modifyRspackConfig}) {
		modifyRspackConfig(({module}) => {
			module = module || {}
			module.rules = module.rules || []
			
			const reactiveLoaderPath = resolve(localDirectory, "reactive-loader.js")
			
			module.rules.push({
				test: /\.tsx$/,
				exclude: /node_modules/,
				enforce: "pre",
				use: [
					{
						loader: reactiveLoaderPath,
					},
				],
			})
		})
	},
})