/**
 * Map based registry to track functions during development
 *
 * @type {Map<string, Function>}
 */
export const developmentFnManifest: Map<string, Function> = new Map<string, Function>()

/**
 * Map based registry to track built functions in production
 *
 * @type {Map<string, string>}
 */
export const productionFnManifest: Map<string, string> = new Map<string, string>()

/**
 *  Visitors can pass new state objects to their children with next(childState) or visit(node, childState)
 */
export interface VisitorState {
	exportedFns: string[]
}

/**
 * Helper type to stop TypeScript from typing dynamic imports as any
 */
export type ServerModule = Record<string, (...args: unknown[]) => unknown>;

export type RuntimeEnvironment = "bun" | "node"

export type Preset = (RuntimeEnvironment | "cloudflare-workers" | "generic") & (string & {})

export type LogLevel = "normal" | "debug" | "verbose"

export interface PluginOptions {
	preset: Preset;
	logLevel?: LogLevel | "normal"
}

export interface LiveLine {
	update: (text: string) => void
	done: (finalText?: string) => void
}
