import { describe, expect, it } from "rstack/test"

import { e, validateEnv } from "../src"

const envVars = validateEnv({
	PORT: e.number(),
	USERNAME: e.string(),
	NODE_ENV: e.enum(["development", "production", "test"] as const),
})

describe("Typed Env", () => {
	it("Reads environment variables from .env.test", () => {
		expect(envVars.PORT).toBe(5555)
		expect(envVars.NODE_ENV).toBe("test")
		expect(envVars.USERNAME).toBe("mpayne")
	})
	
	it("Runs all validation rules and throws errors on bad inputs", () => {
		const numberValidator = e.number().refine((val) => val > 10, "")
		
		expect(numberValidator.parse(42)).toBe(42)
		expect(() => numberValidator.parse("abc")).toThrow()
	})
})
