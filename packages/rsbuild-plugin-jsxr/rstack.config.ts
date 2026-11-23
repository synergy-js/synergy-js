import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin"
import { define } from "rstack"
//@ts-ignore
import { sharedConfig } from "../../shared.config.ts"

define.extends([sharedConfig])
define.lib({
	lib: [
		{
			id: "rsbuild-plugin-jsxr",
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
				//tsconfigPath: "tsconfig.lib.json",
				entry: {
					index: ["src/**", "!src/**__*.ts", "compiler"],
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