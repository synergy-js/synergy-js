import { afterAll, beforeAll, describe, expect, test } from "rstack/test" // or "bun:test"
import { err, ok, tryAsync } from "../src"

describe("HTTP Fetch Integration (Real Server)", () => {
	let server: ReturnType<typeof Bun.serve>
	let flakyHits = 0
	
	beforeAll(() => {
		server = Bun.serve({
			port: 0,
			hostname: "localhost",
			routes: {
				"/api/test": {
					GET: () => Response.json({message: "IT WORKED!"}),
				},
				"/api/users/:id": {
					POST: async (req) => {
						const auth = req.headers.get("authorization")
						if(!auth) {
							return Response.json({error: "Unauthorized"}, {status: 401})
						}
						const body = (await req.json()) as {name?: string}
						return Response.json(
							{id: req.params.id, name: body.name ?? "Unknown"},
							{status: 201},
						)
					},
				},
				"/api/flaky": {
					GET: () => {
						flakyHits++
						if(flakyHits < 3) {
							return new Response("Service Unavailable", {status: 503})
						}
						return Response.json({status: "healthy", attempt: flakyHits})
					},
				},
			},
		})
	})
	
	afterAll(() => {
		server?.stop(true)
	})
	
	test("GET request parses JSON and unwraps cleanly", async () => {
		const message = await tryAsync(
			async () => {
				const res = await fetch(`${server.url}api/test`)
				if(!res.ok) throw new Error(`HTTP ${res.status}`)
				return (await res.json()) as {message: string}
			},
			"FETCH_TEST_FAILED",
		)
			.map((data) => data.message)
			.unwrapOr("fallback")
		
		expect(message).toBe("IT WORKED!")
	})
	
	test("POST request sends headers/body and maps HTTP status into typed Err", async () => {
		const postUser = (token?: string) =>
			tryAsync(
				async () => {
					const res = await fetch(`${server.url}api/users/42`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							...(token ? {Authorization: `Bearer ${token}`} : {}),
						},
						body: JSON.stringify({name: "Ada"}),
					})
					return {status: res.status, data: await res.json()}
				},
				"POST_USER_CRASH",
			).andThen(({status, data}) =>
				status === 201
				? ok(data as {id: string; name: string})
				: err({code: "UNAUTHORIZED", message: data.error, status}),
			)
		
		// 1. Missing auth header -> structured Err
		const unauth = await postUser()
		expect(unauth.isErr()).toBe(true)
		if(unauth.isErr()) {
			expect(unauth.error.code).toBe("UNAUTHORIZED")
			expect(unauth.error.status).toBe(401)
		}
		
		// 2. Valid auth header -> Ok
		const authed = await postUser("secret-token")
		expect(authed.unwrap()).toEqual({id: "42", name: "Ada"})
	})
	
	test("tryAsync retries real 503 responses until the server recovers", async () => {
		flakyHits = 0
		
		const res = await tryAsync(
			async () => {
				const response = await fetch(`${server.url}api/flaky`)
				if(!response.ok) {
					throw new Error(`HTTP ${response.status}`)
				}
				return (await response.json()) as {status: string; attempt: number}
			},
			{attempts: 4, delayMs: 5},
			"FLAKY_ENDPOINT_DOWN",
		)
		
		expect(res.isOk()).toBe(true)
		expect(res.unwrap()).toEqual({status: "healthy", attempt: 3})
	})
})
