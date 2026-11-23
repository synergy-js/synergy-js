import { bootstrap, type RequestScope } from "@synergy-js/srvr"
import { wcgAdapter, bunAdapter } from "@synergy-js/srvr/adapters"
import indexHtml from "./index.html"
import { logger } from "./interceptors.ts"
import { TestController } from "./routes/test.tsx"
import { UsersController } from "./routes/users.ts"

await bootstrap({
	controllers: [
		UsersController,
		TestController,
	],
	interceptors: [logger],
	adapter: bunAdapter({
		port: 8889,
		routes: {
			"/": indexHtml,
		},
	}),
})