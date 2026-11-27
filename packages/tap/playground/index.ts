import { createHooks, createPlugin } from "../src"

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

const appPlugin = createPlugin<typeof appHooks>()

const dbPlugin = appPlugin(({context, hooks}) => {
	hooks.hook("error", (error, context) => {
		console.log(context?.source)
	})
})

appPlugin((app) => app.context.env)