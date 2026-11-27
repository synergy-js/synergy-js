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
			source: {
				entry: {
					index: ["src/**", "!src/**__*.ts", "!src/*.png"],
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
})