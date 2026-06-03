import { describe, it, expect, vi, beforeEach } from "vitest";
import { logRouteError } from "../../src/utils/logRouteError";

// Minimal mock Hono Context
function createMockContext(opts: {
  method?: string;
  url?: string;
  status?: number;
}) {
  const req = {
    method: opts.method ?? "GET",
    url: opts.url ?? "http://localhost:3000/api/v1/test",
  };
  return {
    req,
    status: opts.status ?? 500,
  } as unknown as import("hono").Context;
}

function createMockLogger() {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
}

describe("logRouteError", () => {
  it("logs error message with method, path, and status", () => {
    const logger = createMockLogger();
    const c = createMockContext({ method: "GET", url: "/api/v1/users", status: 404 });

    logRouteError(logger as any, { c, error: new Error("Not found") });

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [meta, msg] = logger.error.mock.calls[0];

    expect(meta.method).toBe("GET");
    expect(meta.path).toBe("/api/v1/users");
    expect(meta.status).toBe(404);
    expect(meta.type).toBe("route_error");
    expect(msg).toContain("GET");
    expect(msg).toContain("/api/v1/users");
    expect(msg).toContain("404");
    expect(msg).toContain("Not found");
  });

  it("strips query strings from the path", () => {
    const logger = createMockLogger();
    const c = createMockContext({
      method: "POST",
      url: "http://localhost:3000/api/v1/economy/transfer?from=user1&to=user2&amount=100",
      status: 400,
    });

    logRouteError(logger as any, { c, error: new Error("Insufficient funds") });

    const [meta] = logger.error.mock.calls[0];
    expect(meta.path).toBe("/api/v1/economy/transfer");
    expect(meta.method).toBe("POST");
    expect(logger.error.mock.calls[0][1]).not.toContain("?");
  });

  it("includes error code when present on error object", () => {
    const logger = createMockLogger();
    const c = createMockContext({ status: 429 });

    const err = new Error("Cooldown active");
    (err as any).code = "COOLDOWN_ACTIVE";

    logRouteError(logger as any, { c, error: err });

    const [meta] = logger.error.mock.calls[0];
    expect(meta.errorCode).toBe("COOLDOWN_ACTIVE");
  });

  it("merges extra meta from caller", () => {
    const logger = createMockLogger();
    const c = createMockContext({ status: 500 });

    logRouteError(logger as any, {
      c,
      error: new Error("DB failure"),
      meta: { query: "SELECT * FROM users", duration_ms: 3000 },
    });

    const [meta] = logger.error.mock.calls[0];
    expect(meta.query).toBe("SELECT * FROM users");
    expect(meta.duration_ms).toBe(3000);
  });

  it("handles non-Error values gracefully", () => {
    const logger = createMockLogger();
    const c = createMockContext({ status: 500 });

    logRouteError(logger as any, { c, error: "Something went wrong" });
    // @ts-expect-error — testing defensive handling of null/undefined
    logRouteError(logger as any, { c, error: null });
    // @ts-expect-error — testing defensive handling of null/undefined
    logRouteError(logger as any, { c, error: undefined });

    expect(logger.error).toHaveBeenCalledTimes(3);
    // All should produce a message string
    const calls = logger.error.mock.calls;
    expect(calls[0][1]).toContain("Something went wrong");
    expect(calls[1][1]).toContain("null");
    expect(calls[2][1]).toContain("undefined");
  });
});