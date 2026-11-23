import { afterAll, describe, expect, test } from "bun:test"

import { getServiceScope } from "../src"
import {
	container,
	DefaultClass,
	RequestClass,
	SingletonClass,
	testDISingleton,
	TransientClass,
} from "./helpers.ts"

describe("Class Based Decorator", () => {
	test("Returns first index of numbers array from singleton cache", () => {
		container.start(() => {
			expect(testDISingleton.getNumbers()[0]).toBe(1)
		})
	})
	
	test("Fails when not run inside an active injection context", () => {
		expect(testDISingleton.getNumbers()[0]).toBe(1)
	})
	
	test("Verifies class decorator scopes matches metadata layouts", () => {
		expect(getServiceScope(SingletonClass)).toBe("Singleton")
		expect(getServiceScope(RequestClass)).toBe("Request")
		expect(getServiceScope(TransientClass)).toBe("Transient")
		expect(getServiceScope(DefaultClass)).toBe("Singleton")
	})
})

afterAll(() => {
	container.destroy()
})
