import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin"
import { kineticPlugin } from "@synergy-js/rsbuild-plugin-kinetic"
import { define } from "rstack"
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
					index: ["src/**", "!src/__*.ts", "router/**", "signals"],
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
	plugins: [kineticPlugin()],
	testEnvironment: "happy-dom",
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