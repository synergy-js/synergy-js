import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin"
import { define } from "rstack"
//@ts-ignore
import { sharedConfig } from "../../shared.config.ts"

define.extends([sharedConfig])
define.lib({
	lib: [
		{
			id: "kinetic",
			bundle: false,
			dts: {
				isolated: true,
			},
			output: {
				target: "web",
			},
			source: {
				entry: {
					index: ["src/**", "!src/__*.ts", "router/**"],
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
define.test({
	testEnvironment: "happy-dom",
})