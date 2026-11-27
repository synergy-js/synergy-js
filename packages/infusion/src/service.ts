import { INJECTABLE_META, type ServiceOptions, type TokenType, type InjectableMetadata } from "./types.ts"


export function Service<T>(options: ServiceOptions<T> = {}) {
	return function <TClass extends TokenType<T>>(
		targetClass: TClass,
		context: ClassDecoratorContext<TClass>,
	): void {
		if(context.kind !== "class") {
			throw new Error("@Service can only be applied to classes.")
		}
		Object.defineProperty(targetClass, INJECTABLE_META, {
			value: {
				scope: options.scope ?? "Singleton",
				autoProvided: options.autoProvided ?? true,
				factory: options.factory,
			},
			configurable: true,
		})
	}
}

export function getServiceMeta<T = unknown>(target: unknown): InjectableMetadata<T> | undefined {
	if(typeof target === "function" && INJECTABLE_META in target) {
		return (target as Record<symbol, InjectableMetadata<T>>)[INJECTABLE_META]
	}
	return undefined
}
