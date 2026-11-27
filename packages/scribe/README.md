# @synergy-js/scribe

Structured, context-aware logging with pluggable transports. Emit level-tagged payloads to the console, a file, a remote endpoint, or your own transport.

## Features

- `trace`, `debug`, `info`, `warn` and `error` levels with named child contexts (`api::users`)
- Transport pipeline: each log payload is dispatched to every configured transport
- Built-in transports: console (ANSI-coloured), JSON-lines file and batched remote shipper
- `withFilter()` for per-transport minimum levels
- Chainable ANSI colour helpers (`colors.bold.green(...)`) and live-line progress output
- A `LogTransport` is just `(payload: LogPayload) => void | Promise<void>`

> The built-in console and file transports use Bun APIs (`Bun.stdout.writer`, `Bun.file`). Custom transports work in any runtime.

## Installation

```bash
pnpm add @synergy-js/scribe
```

## Quick start

```ts
import {
  Scribe,
  consoleTransport,
  fileTransport,
  withFilter,
} from "@synergy-js/scribe"

const file = await fileTransport("./logs/app.log")

const logger = new Scribe("api", [
  withFilter("info", consoleTransport()),
  file,
]).child("users")

logger.info("request received", { id: 42 })
logger.error("request failed", new Error("timeout"))
// [timestamp] INFO [api::users]: request received
```

A `Scribe` with no transports is a no-op, which makes it easy to disable logging in tests.

## Built-in transports

| Transport | Description |
| --- | --- |
| `consoleTransport()` | Colour-coded, formatted output to stdout; prints object args via `Bun.inspect` |
| `fileTransport(path)` | Async; writes one JSON payload per line, flushing on errors and process exit |
| `remoteStorageTransport(url, maxBatchSize = 10)` | Batches payloads into `POST {logs: [...]}`; flushes on errors and `beforeExit` |
| `withFilter(minLevel, transport)` | Wraps a transport so it only receives logs at or above `minLevel` |

## Helpers

```ts
import { colors, log } from "@synergy-js/scribe"

console.log(colors.bold.green("ready"))
log.success("server started")
log.info("listening", "port 3000")

const progress = log.live()
progress.update("downloading… 40%")
progress.done("downloaded")
```

## Types

`LogPayload` = `{ level, timestamp, context?, message, args?, durationMs? }`; `LogLevel` = `"trace" | "debug" | "info" | "warn" | "error"`. Use these to write custom transports.

## License

MIT
