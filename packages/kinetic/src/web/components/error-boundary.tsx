import { createSignal, useContext } from "../../signals"
import type { JSXElement } from "../../types.ts"
import { createContext } from "../context.ts"

export type ErrorBoundaryFallback = (err: unknown, reset: () => void) => JSXElement

export interface ErrorBoundaryProps {
	fallback: JSXElement | ErrorBoundaryFallback
	onError?: (err: unknown) => void
	children?: JSXElement
}

const ErrorBoundaryContext = createContext<((err: unknown) => void) | undefined>(undefined)

/**
 * Get a handler that reports an error to the nearest ErrorBoundary.
 * Without a boundary, invoking the handler throws the error.
 */
export const useErrorHandler = (): (err: unknown) => void => {
	const report = useContext(ErrorBoundaryContext)
	return (err: unknown) => {
		if(report) {
			report(err)
		}
		else {
			throw err
		}
	}
}

/** Catch synchronous child errors and display a fallback that can reset the boundary. */
export const ErrorBoundary = (props: ErrorBoundaryProps): JSXElement => {
	const [error, setError] = createSignal<unknown>(undefined)
	
	const handleError = (err: unknown) => {
		props.onError?.(err)
		setError(() => err)
	}
	
	const reset = () => setError(undefined)
	
	return (
		<ErrorBoundaryContext.Provider value={handleError}>
			{() => {
				const currentErr = error()
				if(currentErr !== undefined) {
					return typeof props.fallback === "function"
					       ? (props.fallback as ErrorBoundaryFallback)(currentErr, reset)
					       : props.fallback
				}
				
				try {
					return typeof props.children === "function"
					       ? (props.children as () => JSXElement)()
					       : props.children
				}
				catch(err) {
					handleError(err)
					return null
				}
			}}
		</ErrorBoundaryContext.Provider>
	)
}
