import type { LogLevel, LogPayload, LogTransport } from "./types.ts"
import { logWeights } from "./types.ts"

/**
 * Terminal console output
 * @returns {LogTransport}
 */
export const consoleTransport = (): LogTransport => {
	// 1. Get an incremental, high-performance binary stream sink straight to stdout
	const writer = Bun.stdout.writer() //
	
	const RESET = Bun.color("reset", "ansi-16")
	const GRAY = Bun.color("gray", "ansi-16")
	const MAGENTA = Bun.color("magenta", "ansi-16")
	
	const levelColors: Record<LogLevel, string> = {
		debug: Bun.color("cyan", "ansi-16") ?? "cyan",
		info: Bun.color("green", "ansi-16") ?? "green",
		warn: Bun.color("yellow", "ansi-16") ?? "yellow",
		error: Bun.color("red", "ansi-16") ?? "red",
		trace: Bun.color("magenta", "ansi-16") ?? "magenta",
	}
	
	const cachedTags = Object.fromEntries(
		Object.entries(levelColors).map(([level, color]) => [level, `${color}${level.toUpperCase().padEnd(5)}${RESET}`]),
	) as Record<LogLevel, string>
	
	return (payload) => {
		// Directly drop the payload fields straight into the stream without any string slicing
		const timeTag = `${GRAY}${payload.timestamp}${RESET}`
		
		const levelTag = cachedTags[payload.level]
		
		const contextTag = payload.context ? ` ${GRAY}[${payload.context}]${RESET}` : ""
		
		const durationTag = payload.durationMs !== undefined ? ` ${MAGENTA}(+${payload.durationMs}ms)${RESET}` : ""
		
		writer.write(`${timeTag} ${levelTag}${contextTag}: ${payload.message}${durationTag}\n`)
		
		if(!payload.args) {
			return
		}
		
		for(let i = 0; i < payload.args.length; i++) {
			const arg = payload.args[i]
			
			if(typeof arg === "object" && arg !== null) {
				writer.write(Bun.inspect(arg, {colors: true}) + "\n")
			}
			else {
				writer.write(`  └─ ${arg}\n`)
			}
		}
		
		writer.flush()
	}
}

/**
 * Writes logs to a file using a file sink
 * @param {string} outputPath
 * @returns {LogTransport}
 */
export const fileTransport = async (outputPath: string): Promise<LogTransport> => {
	const importedFsModule = await import("node:fs/promises")
	const importedPathModule = await import("node:path")
	
	await importedFsModule.mkdir(importedPathModule.dirname(outputPath), {
		recursive: true,
	})
	
	const file = Bun.file(outputPath)
	const writer = file.writer()
	
	process.on("exit", () => writer.end())
	
	return (payload) => {
		writer.write(`${JSON.stringify(payload)}\n`)
		
		if(payload.level === "error") {
			writer.flush()
		}
	}
}

/**
 * Asynchronous remote storage bulk log shipper
 * @param {string} endpointUrl
 * @param {number} maxBatchSize
 * @returns {LogTransport}
 */
export const remoteStorageTransport = (endpointUrl: string, maxBatchSize = 10): LogTransport => {
	let queue: LogPayload[] = []
	
	const flushQueue = async (isExiting = false) => {
		if(queue.length === 0) {
			return
		}
		const batchToSend = [...queue]
		queue = [] // Drain instantly to keep main thread execution clean
		
		try {
			// standard fetch block used natively across both runtime tracks
			await fetch(endpointUrl, {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({logs: batchToSend}),
				// If the process is exiting, set a strict network drop signal so it doesn't hang
				signal: isExiting ? AbortSignal.timeout(500) : undefined,
			})
		}
		catch {
			// Fail silently on unreachable servers
		}
	}
	
	// Force an automatic, clean batch dispatch when the application lifecycle ends
	process.on("beforeExit", async () => {
		if(queue.length > 0) {
			// Await the standard async fetch call cleanly before the thread lets go
			await flushQueue(true)
		}
	})
	
	return async (payload) => {
		queue.push(payload)
		
		// If we hit our batch ceiling threshold or an error occurs, flush out immediately
		if(queue.length >= maxBatchSize || payload.level === "error") {
			await flushQueue()
		}
	}
}

/**
 *
 * @param {LogLevel} minLevel
 * @param {LogTransport} transport
 * @returns {LogTransport}
 */
export const withFilter = (minLevel: LogLevel, transport: LogTransport): LogTransport => {
	const minWeight = logWeights[minLevel]
	
	return (payload) => {
		if((logWeights[payload.level] ?? 2) >= minWeight) {
			return transport(payload)
		}
	}
}
