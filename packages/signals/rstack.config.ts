import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin"
import { define } from "rstack"
import { sharedConfig } from "../../shared.config.ts"

define.extends([sharedConfig])
define.lib({
	lib: [
		{
			id: "signals",
			bundle: false,
			dts: {
				isolated: true,
			},
			output: {
				cleanDistPath: true,
				minify: true,
				target: "web",
			},
			source: {
				tsconfigPath: "tsconfig.lib.json",
				entry: {
					index: ["src/**", "!src/**__*.ts"],
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