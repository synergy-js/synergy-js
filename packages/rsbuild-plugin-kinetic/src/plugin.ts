import type { RsbuildPlugin } from "rstack/app"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const filename = fileURLToPath(import.meta.url)

const localDirectory = dirname(filename)

const reactiveLoaderPath = resolve(localDirectory, "loader.js")

export const kineticPlugin = (): RsbuildPlugin => ({
	name: "Kinetic Plugin",
	setup({modifyRspackConfig, modifyRsbuildConfig}) {
		modifyRsbuildConfig((config, {mergeRsbuildConfig}) => {
			return mergeRsbuildConfig(config, {
				tools: {
					swc: {
						jsc: {
							transform: {
								react: {
									runtime: "automatic",
									importSource: "@synergy-js/kinetic",
								},
							},
						},
					},
				},
			})
		})
		
		modifyRspackConfig((config, {mergeConfig}) => {
			return mergeConfig(config, {
				module: {
					rules: [
						{
							test: /\.tsx$/,
							exclude: /node_modules/,
							enforce: "pre",
							use: [
								{
									loader: reactiveLoaderPath,
								},
							],
						},
					],
				},
			})
		})
	},
})