import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin"
import { define } from "rstack"
import { sharedConfig } from "../../shared.config.ts"

define.extends([sharedConfig])
define.lib({
	lib: [
		{
			id: "prism",
			bundle: false,
			dts: {
				isolated: true,
			},
			source: {
				entry: {
					index: ["src/**", "!src/**/__*.ts"],
				},
			},
			output: {
				target: "web",
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