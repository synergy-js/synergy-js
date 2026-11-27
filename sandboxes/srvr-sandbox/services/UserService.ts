import { Injectable, InjectionToken } from "@synergy-js/infusion"

@Injectable({scope: "Singleton"})
export class UserService {
	getUsers(): {id: number; name: string; role: string}[] {
		return [
			{id: 1, name: "Alice", role: "Admin"},
			{id: 2, name: "Bob", role: "Developer"},
		]
	}
}

export interface User {
	id: number;
	name: string;
	role: string;
}

export interface ITestConfig {
	url?: string;
	users: User[];
}

// Declare the token and hand it its own explicit factory value provider block!
export const TEST_CONFIG: InjectionToken<ITestConfig> =
	new InjectionToken<ITestConfig>("Core API Config Setup", {
		factory: () => ({
			users: [
				{id: 1, name: "Alice", role: "Admin"},
				{id: 2, name: "Bob", role: "Developer"},
			],
		}),
	})
