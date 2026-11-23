import { type Server } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { tryAsync } from "../../rustify/src";
import { HttpClient, HttpError, HttpStatusCodes } from "../src";

let server: Server<undefined>;
let lastReceivedHeaders: Headers | null = null;

beforeAll(() => {
  server = Bun.serve({
    port: 5000,
    hostname: "localhost",
    id: "testing",
    routes: {
      "/api/test": {
        GET: () => Response.json({ message: "IT WORKED" }),
      },
      "/api/get-headers": {
        GET: (req, _server) => {
          lastReceivedHeaders = req.headers;
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
      "/api/users/:id": {
        GET: (req, server) => {
          const { id } = req.params;
          if (!id) {
            throw new HttpError(HttpStatusCodes.BAD_GATEWAY, "Missing ID");
          }
          return Response.json({ status: HttpStatusCodes.OK });
        },
        POST: async (request) => {
          const { id } = request.params;
          if (!id) {
            throw new HttpError(HttpStatusCodes.BAD_REQUEST, "Bad request");
          }
          return Response.json(HttpStatusCodes.CREATED);
        },
      },
    },
  });
});

const httpClient = new HttpClient("http://localhost:5000");

describe("HTTP Client", () => {
  test("Fetches data from localhost", async () => {
    const result = await httpClient.get<{ message: string }>("/api/test");
    expect(result?.message).toBe("IT WORKED");
  });

  test("Posts content to localhost", async () => {
    interface User {
      id: number;
      firstName: string;
      lastName: string;
    }

    const user = {
      id: 1,
      firstName: "John",
      lastName: "Smith",
    } satisfies User;

    const result = await tryAsync(() =>
      httpClient.post("/api/users/:id", user),
    );

    expect(result.isOk()).toBe(true);
  });

  test("Creates a response interceptor", () => {
    httpClient.interceptors.response = (response, data) => {
      if (response.ok) {
        expect(data).toBeDefined();
      }
      return data;
    };
  });

  test("Creates a request interceptor and sets custom headers", async () => {
    lastReceivedHeaders = null;
    httpClient.interceptors.request = (options) => {
      options.headers = {
        ...(options.headers || {}),
        "X-Custom-Client-ID": "api-testing",
      };
      return options;
    };
    const headerHelper = await httpClient.get<{ success: boolean }>(
      "/api/get-headers",
    );

    expect(headerHelper?.success).toBeTrue();
    expect(lastReceivedHeaders).not.toBeNull();
    expect(lastReceivedHeaders!.get("X-Custom-Client-ID")).toBe("api-testing");
  });
});

afterAll(async () => await server.stop());
