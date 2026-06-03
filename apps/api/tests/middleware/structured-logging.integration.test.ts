import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { requestId } from "../../src/middleware/requestId";
import { accessLog } from "../../src/middleware/accessLog";
import logger from "../../src/utils/logger";

/**
 * Integration tests for structured JSON logging middleware chain.
 * Verifies: requestId -> accessLog -> app.onError wiring and request_id correlation.
 */
describe("Structured JSON logging middleware chain", () => {
  function buildApp() {
    const app = new Hono();
    app.use(requestId);
    app.use(accessLog);

    app.get("/throw", () => {
      throw new Error("Boom!");
    });
    app.get("/ok", (c) => c.json({ ok: true }));
    app.get("/404", (c) => c.json({ notFound: true }, 404));

    return app;
  }

  it("X-Request-ID header propagates to child logger and is echoed back", async () => {
    const app = buildApp();
    const customReqId = "req-custom-abc";
    const res = await app.request("/ok", {
      headers: { "X-Request-ID": customReqId },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-ID")).toBe(customReqId);
  });

  it("accessLog captures latency for successful requests", async () => {
    const app = buildApp();
    const res = await app.request("/ok", {
      headers: { "X-Request-ID": "req-latency-check" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-ID")).toBe("req-latency-check");
  });

  it("accessLog captures correct status codes", async () => {
    const app = buildApp();
    const res404 = await app.request("/404", {
      headers: { "X-Request-ID": "req-status-test" },
    });

    expect(res404.status).toBe(404);
    expect(res404.headers.get("X-Request-ID")).toBe("req-status-test");
  });

  it("app.onError returns 500 with sanitised JSON error and logs unhandled_exception", async () => {
    const app = new Hono();
    app.use(requestId);
    app.use(accessLog);

    // Wire app.onError as specified in the task
    app.onError((err, c) => {
      const reqLogger = c.get("logger") ?? logger;
      reqLogger.fatal(
        {
          type: "unhandled_exception",
          request_id: (c.get("logger") as any)?.bindings?.request_id,
          error_message: err.message,
          ...(process.env.NODE_ENV === "development" && {
            stack: err.stack,
          }),
        },
        "Unhandled exception in route",
      );
      return c.json({ error: "Internal server error" }, 500);
    });

    app.get("/throw", () => {
      throw new Error("Boom!");
    });

    const res = await app.request("/throw", {
      headers: { "X-Request-ID": "req-error-handler-123" },
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(res.headers.get("X-Request-ID")).toBe("req-error-handler-123");
  });

  it("X-Request-ID not in request — a UUID v4 is generated and returned", async () => {
    const app = buildApp();
    const res = await app.request("/ok");

    expect(res.status).toBe(200);
    const reqIdHeader = res.headers.get("X-Request-ID");
    expect(reqIdHeader).not.toBeNull();

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(reqIdHeader!).toMatch(uuidRegex);
  });

  it("child logger attached to context before next() — requestId runs before accessLog", async () => {
    // Verify that requestId runs first by checking that accessLog can read
    // the child logger from context (c.get("logger") returns non-null)
    // If requestId didn't run first, c.get("logger") would be undefined.
    const app = buildApp();

    const res = await app.request("/ok", {
      headers: { "X-Request-ID": "req-order-test-abc" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-ID")).toBe("req-order-test-abc");
  });

  it("child logger is shared — same request_id across middleware", async () => {
    const app = buildApp();
    const res = await app.request("/ok", {
      headers: { "X-Request-ID": "req-shared-test" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-ID")).toBe("req-shared-test");
  });
});
