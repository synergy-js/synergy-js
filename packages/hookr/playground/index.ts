import { createHooks, definePlugin } from "../src"

type Hooks = {
	"request": (req: Request) => void | Promise<void>
	"response": (res: Response) => void | Promise<void>
}

interface Context {
	env: string
	db?: {
		close: () => Promise<void>
	}
}

const appHooks = createHooks<Hooks, Context>({
	env: "dev",
})

const app = definePlugin<typeof appHooks>()

const dbPlugin = app(({context, hooks}) => {
	hooks.hook("error", (error, context) => {
		console.log(context?.source)
	})
})

app((app) => app.context.env)