import { consoleTransport, remoteStorageTransport, Scribe, withFilter } from "../src"

const mockLogServer = Bun.serve({
	port: 0, // 0 tells Bun to dynamically pick any available random open port
	async fetch(req) {
		const url = new URL(req.url)
		
		if(req.method === "POST" && url.pathname === "/logs") {
			const payload = await req.json() // Parse the sent log array
			
			console.log("\n[Received Remote Shipments]:")
			console.log(JSON.stringify(payload, null, 2))
			
			return new Response("OK", {status: 200})
		}
		
		return new Response("Not Found", {status: 404})
	},
})

// Calculate the exact local URL (e.g., http://localhost:54321/logs)
const localTargetUrl = `http://localhost:${mockLogServer.port}/logs`
console.log(`Mock Server listening on ${localTargetUrl}`)

// 2. Configure the logger with a dynamic port
const testTransports = [
	// Print warnings and errors onto the terminal screen
	withFilter("warn", consoleTransport()),
	
	// Point the remote shipper directly to your local ephemeral server!
	withFilter("info", remoteStorageTransport(localTargetUrl, 3)),
]

const scribe = new Scribe("Sandbox", testTransports)

// Execute traces to trigger network transactions
scribe.info("\nDispatching operational events...")

// Send 3 info statements to hit the maxBatchSize threshold and force an asynchronous flush
scribe.info("Event #1: Initializing network routine context map.")
scribe.info("Event #2: Cache invalidation lookup executing.")
scribe.info("Event #3: High-scale transaction threshold breached!") // <-- This line triggers the HTTP POST

// Send an error statement to immediately bypass the queue and force a direct transaction
scribe.error("Fatal exception: Connection handshake timeout!", {
	code: "ERR_TIMEOUT",
})

// Cleanup and exit, but delay the exit slightly to allow the asynchronous fetch promises to hit localhost
setTimeout(async () => {
	await mockLogServer.stop() // Shut down the server process cleanly
	console.log("\nTest execution complete. Connection closed successfully.")
	process.exit(0)
}, 200)
