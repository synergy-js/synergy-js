import { define } from "rstack"
import { fusionPlugin } from "@synergy-js/fusion/rsbuild"
import { kineticPlugin } from "@synergy-js/rsbuild-plugin-kinetic"

define.app({
	server: {
		port: 8810,
	},
	plugins: [
		fusionPlugin({preset: "bun"}),
		kineticPlugin(),
	],
})
