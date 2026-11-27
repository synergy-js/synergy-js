import { bootstrap } from "@synergy-js/srvr"
import { bunAdapter } from "@synergy-js/srvr/adapters"
import indexHtml from "./index.html"
import { TestController } from "./routes/test.tsx"
import { UsersController } from "./routes/users.ts"

await bootstrap({
	controllers: [
		UsersController,
		TestController,
	],
	interceptors: [],
	adapter: bunAdapter({
		port: 8889,
		routes: {
			"/": indexHtml,
		},
	}),
})