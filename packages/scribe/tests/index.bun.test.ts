import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { type Server } from "bun";

import {
  consoleTransport,
  Scribe,
  LogPayload,
  LogTransport,
  remoteStorageTransport,
  withFilter,
} from "../src";

let server: Server<unknown>;

beforeAll(() => {
  server = Bun.serve({
    port: 0, // 0 tells Bun to dynamically pick any available random open port
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "POST" && url.pathname === "/logs") {
        const payload = await req.json(); // Safely parse the sent log array

        console.log("\n[Mock Server Received Remote Shipments]:");
        console.log(`Received ${JSON.stringify(payload, null, 2)}`);

        return new Response("OK", { status: 200 });
      }

      return new Response("Not Found", { status: 404 });
    },
  });
});

describe("Logger", () => {
  test("Sends data to remote server", () => {
    const localTargetUrl = `http://localhost:${server?.port}/logs`;

    const testTransports = [
      // Print warnings and errors visually onto the terminal screen
      withFilter("warn", consoleTransport()),

      // Point the remote shipper directly to your local ephemeral server!
      withFilter("info", remoteStorageTransport(localTargetUrl, 3)),
    ];
    const log = new Scribe("Sandbox", testTransports);

    // Send 3 info statements to hit the maxBatchSize threshold and force an asynchronous flush
    log.info("Event #1: Initializing network routine context map.");
    log.info("Event #2: Cache invalidation lookup executing.");
    log.info("Event #3: High-scale transaction threshold breached!");

    log.error("Fatal exception: Connection handshake timeout!", {
      code: "ERR_TIMEOUT",
    });
  });

  test("Creates a child logger", () => {
    // 1. Create a mock array to capture the emitted payload objects
    const capturedPayloads: LogPayload[] = [];

    const mockTransport: LogTransport = (payload) => {
      capturedPayloads.push(payload);
    };

    // 2. Instantiate using mock array target instead of consoleTransport
    const infoLogger = new Scribe("info-logger", [
      withFilter("info", mockTransport),
    ]);

    infoLogger.info("From Info Logger");
    expect(infoLogger).toBeDefined();

    // 3. Spawn the child context branch
    const infoLoggerA = infoLogger.child("info-logger-a");
    infoLoggerA.info("From info-logger-a");

    expect(infoLoggerA).toBeDefined();

    // 4. Assert directly on the structured data metrics captured in the stream
    expect(capturedPayloads.length).toBe(2);

    // Verify the exact, pre-baked context path was built on the child target
    expect(capturedPayloads[1].context).toBe("info-logger::info-logger-a");
    expect(capturedPayloads[1].message).toBe("From info-logger-a");
    expect(capturedPayloads[1].level).toBe("info");
  });
});

afterAll(async () => {
  setTimeout(async () => {
    await server.stop(); // Shut down the server process cleanly
    console.log(
      "\n🏁 Test execution complete. Connection closed successfully.",
    );
    process.exit(0);
  }, 200);
});
