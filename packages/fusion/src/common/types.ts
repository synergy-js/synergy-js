export interface FusionServerFunctionMetadata {
	id: string
	method: string
	sourcePath: string
}

/**
 * Helper type to stop TypeScript from typing dynamic imports as any
 */
export type ServerModule = Record<string, (...args: unknown[]) => unknown>;

export type RuntimeEnvironment = "bun" | "node"

export type Preset = (RuntimeEnvironment | "cloudflare-workers" | "generic") & (string & {})

export type LogLevel = "normal" | "debug" | "verbose"

export interface PluginOptions {
	preset: Preset
	logLevel?: LogLevel | "normal"
}
