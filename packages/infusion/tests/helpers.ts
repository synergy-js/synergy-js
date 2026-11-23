import { Injectable, Infusion } from "../src"

@Injectable({ scope: "Singleton" })
export class TestDiSingleton {
    getNumbers() {
        return [1, 2, 3, 4, 5]
    }
}

@Injectable({ scope: "Transient" })
export class TestDiTransient {
    getNumbers() {
        return [1, 2, 3, 4, 5]
    }
}

@Injectable({ scope: "Singleton" })
export class SingletonClass {}

@Injectable({ scope: "Request" })
export class RequestClass {}

@Injectable({ scope: "Transient" })
export class TransientClass {}

@Injectable()
export class DefaultClass {}

export const testDISingleton = new TestDiSingleton()

export interface User {
    id: number
    name: string
    role: string
}

export interface ITestConfig {
    url?: string
    users: User[]
}

export const container = new Infusion()
