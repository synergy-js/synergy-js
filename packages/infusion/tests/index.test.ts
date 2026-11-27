import { describe, expect, it } from "rstack/test"
import { Infusion, Service, getServiceMeta, inject, InjectionToken } from "../src"


describe("Infusion", () => {
	it("stamps default Singleton metadata", () => {
		@Service()
		class DefaultService {
		}
		
		expect(getServiceMeta(DefaultService)).toEqual({
			scope: "Singleton",
			autoProvided: true,
			factory: undefined,
		})
	})
	
	it("shares singleton across root and child containers", () => {
		@Service({scope: "Singleton"})
		class SingletonSvc {
		}
		
		const root = new Infusion()
		const childA = root.createChild()
		const childB = root.createChild()
		
		const a = childA.start(() => inject(SingletonSvc))
		const b = childB.start(() => inject(SingletonSvc))
		
		expect(a).toBe(b) // exact same instance
		expect(a).toBe(root.get(SingletonSvc))
	})
	
	it("isolates request instances per child container", () => {
		@Service({scope: "Request"})
		class ScopedSvc {
		}
		
		const root = new Infusion()
		const childA = root.createChild()
		const childB = root.createChild()
		
		const a1 = childA.start(() => inject(ScopedSvc))
		const a2 = childA.start(() => inject(ScopedSvc))
		const b1 = childB.start(() => inject(ScopedSvc))
		
		expect(a1).toBe(a2)       // cached within same child
		expect(a1).not.toBe(b1)   // isolated across sibling children
	})
	
	it("creates a fresh instance every time for transient", () => {
		@Service({scope: "Transient"})
		class TransientSvc {
		}
		
		const root = new Infusion()
		expect(root.get(TransientSvc)).not.toBe(root.get(TransientSvc))
	})
	
	it("throws when autoProvided is false and not registered", () => {
		@Service({autoProvided: false})
		class ExplicitSvc {
		}
		
		const root = new Infusion()
		expect(() => root.get(ExplicitSvc)).toThrow(/No provider found/)
		
		const child = root.createChild([ExplicitSvc])
		expect(child.get(ExplicitSvc)).toBeInstanceOf(ExplicitSvc)
	})
	
	it("uses custom injection tokens for function based injections", () => {
		interface User {
			id: number
			name: string
			role: string
		}
		
		interface TestConfig {
			url?: string
			users: User[]
		}
		
		//const root = new Infusion()
		const token = new InjectionToken<TestConfig>("CustomToken", {
			factory: () => ({
				users: [
					{id: 1, name: "Alice", role: "Admin"},
					{id: 2, name: "Bob", role: "Developer"},
				],
			}),
		})
		const testing = inject(token)
		expect(testing.users[0].name).toBe("Alice")
		expect(testing.users[0].role).toBe("Admin")
		expect(testing.users[1].name).toBe("Bob")
		expect(testing.users[1].role).toBe("Developer")
	})
})
