import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin"
import { define } from "rstack"
import { sharedConfig } from "../../shared.config.ts"

define.extends([sharedConfig])
define.lib({
	lib: [
		{
			id: "typed-env",
			bundle: false,
			dts: {
				isolated: true,
			},
			output: {
				cleanDistPath: true,
				minify: true,
			},
			source: {
				tsconfigPath: "tsconfig.lib.json",
				entry: {
					index: ["src/**"],
				},
			},
		},
	],
	tools: {
		rspack: {
			plugins: [
				process.env.RSDOCTOR ? new RsdoctorRspackPlugin({port: 8000}) : null,
			],
		},
	},
	splitChunks: {
		preset: "default",
	},
})