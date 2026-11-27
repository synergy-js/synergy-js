import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin"
import { define } from "rstack"
import { sharedConfig } from "../../shared.config.ts"

define.extends([sharedConfig])
define.test({
	source: {
		tsconfigPath: "./tsconfig.test.ts",
	},
})
define.lib({
	lib: [
		{
			id: "verdict",
			bundle: false,
			dts: {
				build: true,
			},
			output: {
				cleanDistPath: true,
				minify: true,
				target: "node",
			},
			source: {
				entry: {
					index: ["src/**", "!src/**/__*.ts"],
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