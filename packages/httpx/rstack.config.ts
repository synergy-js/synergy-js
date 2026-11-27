import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin"
import { define } from "rstack"
import { sharedConfig } from "../../shared.config.ts"

define.extends([sharedConfig])
define.lib({
	lib: [
		{
			id: "http-client",
			bundle: false,
			dts: {
				isolated: true,
			},
			output: {
				cleanDistPath: true,
				minify: true,
			},
			source: {
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