import { define } from "rstack"
import { jsxrPlugin } from "@synergy-js/rsbuild-plugin-jsxr"

define.app({
	server: {
		port: 8810,
	},
	plugins: [jsxrPlugin()],
})
