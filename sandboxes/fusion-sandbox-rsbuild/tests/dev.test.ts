import { createRsbuild } from "@rsbuild/core"
import { describe, expect, test } from "@rstest/playwright"
import { homedir } from "node:os"
import {} from "../rstack.config.ts"

process.env.NODE_ENV = "development"

describe("Solid Plugin", async () => {
	test("Should execute server action successfully in the Sandbox", async ({
		page,
	}) => {
		// 1. Boot the real, live compiler completely outside of Playwright's scope
		const rsbuild = await createRsbuild({
			rsbuildConfig: {
				...config,
				logLevel: "info",
				mode: "development",
			},
		})
		
		const {server} = await rsbuild.startDevServer()
		
		// 2. Playwright ONLY touches the live, fully compiled network port
		// It never reads or evaluates your source code files directly!
		await page.goto(`http://localhost:${server.port}`)
		page.on("console", (msg) => console.log(msg.text()))
		await expect(page.locator("#homedir")).toHaveText(homedir())
		await expect(page.locator("#file-content")).toHaveText(
			"Written by fusion!",
		)
		await page.screenshot({
			path: "./dev.png",
		})
		await server.close()
	})
})
