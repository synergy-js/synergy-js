import { type LogLevel, type LogPayload, type LogTransport } from "./types.ts"

export class Scribe {
	private readonly _context: string | undefined
	
	private readonly _transports: readonly LogTransport[]
	
	constructor(context?: string, transports: readonly LogTransport[] = []) {
		this._context = context
		this._transports = transports
	}
	
	/**
	 * Create and return Scribe instance
	 * @param {string} name
	 * @returns {Scribe}
	 */
	public child(name: string): Scribe {
		// Make sure the user did not pass an empty string
		if(!name || name.trim() === "") {
			return this
		}
		// Construct the child logger's context e.g MyLogger::Scope
		const childContext = this._context ? `${this._context}::${name}` : name
		
		return new Scribe(childContext, this._transports)
	}
	
	/**
	 *
	 * @param {string} msg
	 * @param args
	 */
	public trace(msg: string, ...args: unknown[]): void {
		this._write("trace", msg, args)
	}
	
	/**
	 *
	 * @param {string} msg
	 * @param args
	 */
	public debug(msg: string, ...args: unknown[]): void {
		this._write("debug", msg, args)
	}
	
	/**
	 *
	 * @param {string} msg
	 * @param args
	 */
	public info(msg: string, ...args: unknown[]): void {
		this._write("info", msg, args)
	}
	
	/**
	 *
	 * @param {string} msg
	 * @param args
	 */
	public warn(msg: string, ...args: unknown[]): void {
		this._write("warn", msg, args)
	}
	
	/**
	 *
	 * @param {string} msg
	 * @param args
	 */
	public error(msg: string, ...args: unknown[]): void {
		this._write("error", msg, args)
	}
	
	/**
	 *
	 * @param {LogLevel} level
	 * @param {string} message
	 * @param {unknown[]} args
	 * @param {number} durationMs
	 * @private
	 */
	private _write(
		level: LogLevel,
		message: string,
		args: unknown[],
		durationMs?: number,
	): void {
		// Return if no transports were passed
		if(this._transports.length === 0) {
			return
		}
		
		const payload = {
			level,
			timestamp: new Date().toISOString(),
			context: this._context,
			message,
			args: args.length ? args : undefined,
			durationMs: durationMs ? parseFloat(durationMs.toFixed(2)) : undefined,
		} satisfies LogPayload
		
		for(let i = 0; i < this._transports.length; i++) {
			this._transports[i](payload)
		}
	}
}
