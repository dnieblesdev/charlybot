/**
 * Behavioral tests for ValkeyClient - Scenarios S4, S5, S6, S7
 * 
 * S4: ACK-on-Success Semantics
 * S5: Reclaim PEL After Timeout
 * S6: DLQ on Max Retries
 * S7: Idempotent Reprocessing
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "crypto";
import { createValkeyClient, type ValkeyConfig } from "@charlybot/shared";

// Test configuration - connects to Docker Valkey at localhost:6379 with no password
const testConfig: ValkeyConfig = {
  host: "localhost",
  port: 6379,
  password: "",
  connectTimeoutMs: 5000,
  commandTimeoutMs: 2000,
  maxRetries: 3,
  prefix: "test",
};

// =============================================================================
// S4: ACK-on-Success Semantics
// =============================================================================

describe("S4: ACK-on-Success Semantics", () => {
  let client: ReturnType<typeof createValkeyClient>;
  
  beforeEach(async () => {
    client = createValkeyClient(testConfig);
    await client.connect();
  });
  
  afterEach(async () => {
    await client.disconnect();
  });
  
  it("should remove message from PEL after successful ack", async () => {
    const stream = `test:stream:s4-ack-${randomUUID()}`;
    const group = `test-group-${randomUUID()}`;
    const consumer = `test-consumer-${randomUUID()}`;
    
    try {
      // Create consumer group
      await client.streamCreateGroup(stream, group);
      
      // Add a message
      const messageId = await client.streamAdd(stream, { type: "test", data: "hello" });
      
      // Read from group - message should be in PEL
      const messages = await client.streamReadGroup(stream, group, consumer, 10, 1000);
      expect(messages).toHaveLength(1);
      expect(messages[0]!.id).toBe(messageId);
      
      // Verify message is pending BEFORE ack
      const pendingBefore = await client.streamPending(stream, group);
      expect(pendingBefore).toHaveLength(1);
      
      // Acknowledge the message
      await client.streamAck(stream, group, [messageId]);
      
      // Verify message is NOT pending AFTER ack
      const pendingAfter = await client.streamPending(stream, group);
      expect(pendingAfter).toHaveLength(0);
    } finally {
      // Cleanup
      await client.del(stream);
    }
  });
});

// =============================================================================
// S5: Reclaim PEL After Timeout
// =============================================================================

describe("S5: Reclaim PEL After Timeout", () => {
  let client: ReturnType<typeof createValkeyClient>;
  
  beforeEach(async () => {
    client = createValkeyClient(testConfig);
    await client.connect();
  });
  
  afterEach(async () => {
    await client.disconnect();
  });
  
  it("should claim idle pending entry for another consumer", async () => {
    const stream = `test:stream:s5-claim-${randomUUID()}`;
    const group = `test-group-${randomUUID()}`;
    const consumer1 = `test-consumer1-${randomUUID()}`;
    const consumer2 = `test-consumer2-${randomUUID()}`;
    const minIdleMs = 100; // Short timeout for testing
    
    try {
      // Create consumer group
      await client.streamCreateGroup(stream, group);
      
      // Add a message
      await client.streamAdd(stream, { data: "test" });
      
      // Read by consumer1 - message becomes pending for consumer1
      const messages1 = await client.streamReadGroup(stream, group, consumer1, 10, 1000);
      expect(messages1).toHaveLength(1);
      const messageId = messages1[0].id;
      
      // Verify pending for consumer1
      const pending = await client.streamPending(stream, group);
      expect(pending).toHaveLength(1);
      expect(pending[0]!.consumer).toBe(consumer1);
      
      // Wait for idle timeout
      await new Promise((resolve) => setTimeout(resolve, minIdleMs + 50));
      
      // Claim the message for consumer2
      const claimed = await client.streamClaim(stream, group, minIdleMs, [messageId], consumer2);
      expect(claimed).toHaveLength(1);
      expect(claimed[0]!.id).toBe(messageId);
      
      // Verify message is now owned by consumer2 (check via pending)
      const pendingAfterClaim = await client.streamPending(stream, group);
      expect(pendingAfterClaim).toHaveLength(1);
      expect(pendingAfterClaim[0]!.consumer).toBe(consumer2);
    } finally {
      // Cleanup
      await client.del(stream);
    }
  });
});

// =============================================================================
// S6: DLQ on Max Retries
// =============================================================================

describe("S6: DLQ on Max Retries", () => {
  let client: ReturnType<typeof createValkeyClient>;
  
  beforeEach(async () => {
    client = createValkeyClient(testConfig);
    await client.connect();
  });
  
  afterEach(async () => {
    await client.disconnect();
  });
  
  it("should add message to DLQ stream", async () => {
    const dlqStream = `test:stream:s6-dlq-${randomUUID()}`;
    
    try {
      // Create consumer group for DLQ stream FIRST
      await client.streamCreateGroup(dlqStream, "dlq-group");
      
      // Manually add to DLQ stream (simulating what MusicStreamConsumer does internally)
      const messageId = await client.streamAdd(dlqStream, { 
        originalMessageId: "test-msg-123", 
        reason: "max_retries", 
        attempts: "4" 
      });
      
      // Small delay to ensure message is persisted
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify DLQ stream contains the entry
      const dlqMessages = await client.streamReadGroup(dlqStream, "dlq-group", "dlq-consumer", 10, 1000);
      
      expect(dlqMessages.length).toBeGreaterThanOrEqual(1);
      expect(dlqMessages[0]!.fields.originalMessageId).toBe("test-msg-123");
      expect(dlqMessages[0]!.fields.reason).toBe("max_retries");
      expect(dlqMessages[0]!.fields.attempts).toBe("4");
    } finally {
      // Cleanup
      await client.del(dlqStream);
    }
  });
});

// =============================================================================
// S7: Idempotent Reprocessing
// =============================================================================

describe("S7: Idempotent Reprocessing", () => {
  let client: ReturnType<typeof createValkeyClient>;
  
  beforeEach(async () => {
    client = createValkeyClient(testConfig);
    await client.connect();
  });
  
  afterEach(async () => {
    await client.disconnect();
  });
  
  it("should not redeliver acknowledged message to same consumer", async () => {
    const stream = `test:stream:s7-idempotent-${randomUUID()}`;
    const group = `test-group-${randomUUID()}`;
    const consumer = `test-consumer-${randomUUID()}`;
    
    try {
      // Create consumer group
      await client.streamCreateGroup(stream, group);
      
      // Add a unique message
      const messageId = await client.streamAdd(stream, { type: "test", id: "unique-1" });
      
      // Read it - should get the message
      const messages1 = await client.streamReadGroup(stream, group, consumer, 10, 1000);
      expect(messages1).toHaveLength(1);
      expect(messages1[0]!.id).toBe(messageId);
      
      // Acknowledge the message
      await client.streamAck(stream, group, [messageId]);
      
      // Try to read again with same consumer using '>' (only new messages)
      // Should not see the same message since it's already acknowledged
      const messages2 = await client.streamReadGroup(stream, group, consumer, 10, 100);
      
      // No new messages should be available
      expect(messages2).toHaveLength(0);
      
      // Verify message is gone from PEL
      const pending = await client.streamPending(stream, group);
      expect(pending).toHaveLength(0);
    } finally {
      // Cleanup
      await client.del(stream);
    }
  });
  
  it("should track message as delivered after read (before ack)", async () => {
    const stream = `test:stream:s7-pel-${randomUUID()}`;
    const group = `test-group-${randomUUID()}`;
    const consumer = `test-consumer-${randomUUID()}`;
    
    try {
      // Create consumer group
      await client.streamCreateGroup(stream, group);
      
      // Add a message
      await client.streamAdd(stream, { type: "test", id: "unique-2" });
      
      // Read it
      const messages = await client.streamReadGroup(stream, group, consumer, 10, 1000);
      expect(messages).toHaveLength(1);
      
      // Message should be in PEL (pending) even before ack
      const pending = await client.streamPending(stream, group);
      expect(pending).toHaveLength(1);
      expect(pending[0]!.consumer).toBe(consumer);
      
      // If we try to read again immediately with '>', we won't get it
      // because it's already delivered (pending)
      const messages2 = await client.streamReadGroup(stream, group, consumer, 10, 100);
      expect(messages2).toHaveLength(0);
    } finally {
      // Cleanup
      await client.del(stream);
    }
  });
});
