import { type FrameworkMetadata, type InterceptorFn, type MethodDecoratorFactory } from "../types.ts"


const _getFrameworkMetadata = (context: {metadata: Record<string | symbol, unknown>}): FrameworkMetadata => {
	return context.metadata as FrameworkMetadata
}

/**
 * Scoped Interceptor Decorator.
 * Can be applied to an entire Class Controller or an individual Route Method.
 *
 */
export function UseInterceptor(interceptorFn: InterceptorFn): MethodDecoratorFactory {
	return function <This, Args extends unknown[], Return>(
		_originalMethod: (this: This, ...args: Args) => Return,
		context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
	): void {
		
		if(context.kind !== "method") {
			throw new Error("@UseInterceptor can only be used on class methods.")
		}
		
		// 🛠️ Unpack your keys with clean, local autocomplete. No global leakage.
		const metadata = _getFrameworkMetadata(context)
		
		if(!metadata.interceptors) {
			metadata.interceptors = new Map<string | symbol, InterceptorFn[]>()
		}
		
		const methodName = context.name
		if(!metadata.interceptors.has(methodName)) {
			metadata.interceptors.set(methodName, [])
		}
		
		metadata.interceptors.get(methodName)!.push(interceptorFn)
	}
}
