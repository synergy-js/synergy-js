import type { RstackConfig } from "rstack"

export const sharedConfig: RstackConfig = {
	lib: {
		syntax: "esnext",
		format: "esm",
		output: {
			autoExternal: {
				devDependencies: true,
			},
			cleanDistPath: true,
			legalComments: "inline",
			module: true,
			sourceMap: false,
			minify: {
				jsOptions: {
					minimizerOptions: {
						module: true,
						mangle: false,
						minify: true,
						compress: {
							// Required to keep placeholders for dynamically injected routes/assets
							defaults: false,
						},
						// Required to keep placeholders for dynamically injected routes/assets
						format: {
							preserve_annotations: true,
						},
					},
				},
			},
		},
		tools: {
			rspack: {
				incremental: true,
				stats: {
					errors: true,
					errorDetails: true,
					errorStack: false,
					env: true,
					runtime: true,
				},
				output: {
					clean: true,
					asyncChunks: true,
					module: true,
				},
			},
		},
	},
	test: {
		bail: 1,
		globals: true,
		include: ["**/*.test.ts"],
	},
}