import { describe, it, expect, vi, beforeEach } from "vitest";

const mockChildLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

describe("requestId middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("reads X-Request-ID from header if present", async () => {
    const { requestId } = await import("../../src/middleware/requestId");
    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue("req-abc-123"),
        url: "http://localhost:3000/api/v1/test",
      },
      set: vi.fn(),
      header: vi.fn(),
    } as any;
    const next = vi.fn().mockResolvedValue(undefined);

    await requestId(mockContext, next);

    expect(mockContext.header).toHaveBeenCalledWith("X-Request-ID", "req-abc-123");
    expect(next).toHaveBeenCalled();
  });

  it("generates a UUID when X-Request-ID is absent", async () => {
    const { requestId } = await import("../../src/middleware/requestId");
    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue(undefined),
        url: "http://localhost:3000/api/v1/test",
      },
      set: vi.fn(),
      header: vi.fn(),
    } as any;
    const next = vi.fn().mockResolvedValue(undefined);

    await requestId(mockContext, next);

    // Generated UUID must be a valid v4 UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const capturedId = mockContext.header.mock.calls.find(
      (call) => call[0] === "X-Request-ID",
    )?.[1];
    expect(capturedId).toMatch(uuidRegex);
    expect(next).toHaveBeenCalled();
  });

  it("attaches a child logger with request_id to context via c.set", async () => {
    const { requestId } = await import("../../src/middleware/requestId");
    const requestIdValue = "req-test-456";
    const mockContext = {
      req: {
        header: vi.fn().mockReturnValue(requestIdValue),
        url: "http://localhost:3000/api/v1/test",
      },
      set: vi.fn(),
      header: vi.fn(),
    } as any;
    const next = vi.fn().mockResolvedValue(undefined);

    await requestId(mockContext, next);

    // Verify c.set was called with "logger" key
    expect(mockContext.set).toHaveBeenCalledWith("logger", expect.any(Object));
    expect(next).toHaveBeenCalled();
  });
});
