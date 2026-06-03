import { describe, it, expect, vi, beforeEach } from "vitest";

describe("accessLog middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("emits http_access log after next() with latency", async () => {
    const { accessLog } = await import("../../src/middleware/accessLog");
    const childLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    const mockContext = {
      req: {
        method: "GET",
        url: "http://localhost:3000/api/v1/test?foo=bar",
      },
      res: { status: 200 },
      set: vi.fn(),
      get: vi.fn().mockReturnValue(childLogger),
    } as any;
    const next = vi.fn().mockResolvedValue(undefined);

    await accessLog(mockContext, next);

    expect(next).toHaveBeenCalled();
    expect(childLogger.info).toHaveBeenCalledTimes(1);
    const [meta, msg] = childLogger.info.mock.calls[0];
    expect(meta.type).toBe("http_access");
    expect(meta.method).toBe("GET");
    expect(meta.path).toBe("/api/v1/test");
    expect(meta.status).toBe(200);
    expect(typeof meta.latency_ms).toBe("number");
    expect(meta.latency_ms).toBeGreaterThanOrEqual(0);
    expect(meta.request_id).toBeUndefined(); // no request_id field added by accessLog itself
  });

  it("sanitizes path by stripping query string", async () => {
    const { accessLog } = await import("../../src/middleware/accessLog");
    const childLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    const mockContext = {
      req: {
        method: "POST",
        url: "http://localhost:3000/api/v1/economy/transfer?from=alice&to=bob&amount=1000",
      },
      res: { status: 200 },
      set: vi.fn(),
      get: vi.fn().mockReturnValue(childLogger),
    } as any;
    const next = vi.fn().mockResolvedValue(undefined);

    await accessLog(mockContext, next);

    const [meta] = childLogger.info.mock.calls[0];
    expect(meta.path).toBe("/api/v1/economy/transfer");
    expect(meta.path).not.toContain("?");
  });

  it("uses request_id from child logger via bindings", async () => {
    const { accessLog } = await import("../../src/middleware/accessLog");
    // Create a mock child logger that tracks request_id via bindings (Pino pattern)
    const childLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn().mockReturnThis(),
      // Simulate Pino child bindings - request_id stored via bindings
      bindings: { request_id: "req-attached-789" },
    };
    const mockContext = {
      req: {
        method: "GET",
        url: "http://localhost:3000/api/v1/test",
      },
      res: { status: 200 },
      set: vi.fn(),
      get: vi.fn().mockImplementation((key) => {
        if (key === "logger") return childLogger;
        return undefined;
      }),
    } as any;
    const next = vi.fn().mockResolvedValue(undefined);

    await accessLog(mockContext, next);

    expect(childLogger.info).toHaveBeenCalled();
    const [meta] = childLogger.info.mock.calls[0];
    // Access log reads request_id from the child logger's bindings
    expect(meta.request_id).toBe("req-attached-789");
  });

  it("logs error status when handler sets non-200 status", async () => {
    const { accessLog } = await import("../../src/middleware/accessLog");
    const childLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    const mockContext = {
      req: {
        method: "GET",
        url: "http://localhost:3000/api/v1/users/999",
      },
      res: { status: 404 },
      set: vi.fn(),
      get: vi.fn().mockReturnValue(childLogger),
    } as any;
    const next = vi.fn().mockResolvedValue(undefined);

    await accessLog(mockContext, next);

    const [meta] = childLogger.info.mock.calls[0];
    expect(meta.status).toBe(404);
    expect(meta.type).toBe("http_access");
  });
});
