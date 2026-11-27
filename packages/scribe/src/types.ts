// Terminal Control Characters (ANSI Escape Sequences)
export const ESC: string = "\x1b["
export const RESET: string = `${ESC}0m`
export const MOVE_TO_START: string = "\r"
export const CLEAR_LINE: string = "\x1b[2K" // Completely erases the current line so long text doesn't bleed

export interface LiveLine {
	update: (text: string) => void
	done: (finalText?: string) => void
}

export interface ColorFormatter {
	(text: string | number): string
	
	// Styles & Modifiers
	get bold(): ColorFormatter
	
	get dim(): ColorFormatter
	
	get italic(): ColorFormatter
	
	get underline(): ColorFormatter
	
	// Foreground Colors
	get red(): ColorFormatter
	
	get green(): ColorFormatter
	
	get yellow(): ColorFormatter
	
	get blue(): ColorFormatter
	
	get magenta(): ColorFormatter
	
	get cyan(): ColorFormatter
	
	get gray(): ColorFormatter
	
	get bgRed(): ColorFormatter
	
	get bgGreen(): ColorFormatter
	
	get bgYellow(): ColorFormatter
	
	get bgBlue(): ColorFormatter
	
	get bgMagenta(): ColorFormatter
	
	get bgCyan(): ColorFormatter
}

/**
 * Grouped mapping lookup tables
 */
export const codes = {
	bold: 1,
	dim: 2,
	italic: 3,
	underline: 4,
	red: 31,
	green: 32,
	yellow: 33,
	blue: 34,
	magenta: 35,
	cyan: 96,
	gray: 90,
	bgRed: 41,
	bgGreen: 42,
	bgYellow: 43,
	bgBlue: 44,
	bgMagenta: 45,
	bgCyan: 46,
} as const

export type ColorKey = keyof typeof codes

export type LogLevel = "debug" | "info" | "warn" | "error" | "trace"

export interface LogPayload {
	level: LogLevel
	timestamp: string
	context?: string
	message: string
	args?: unknown[]
	durationMs?: number
}

export const logWeights: Record<LogLevel, number> = {
	trace: 0,
	debug: 1,
	info: 2,
	warn: 3,
	error: 4,
} as const

export type LogTransport = (payload: LogPayload) => void | Promise<void>
