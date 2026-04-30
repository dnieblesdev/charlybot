import express from "express";
import { getValkeyClient } from "../valkey";
import { createMetricsRegistry } from "@charlybot/shared";

// Create metrics registry from shared module
const { register, errorCounter, valkeyCircuitGauge, prismaQueryHistogram } = createMetricsRegistry();

// Add bot-specific metrics to the shared registry
const commandDuration = new (require("prom-client").Histogram)({
  name: 'charlybot_command_duration_seconds',
  help: 'Command execution duration in seconds',
  labelNames: ['command'],
  registers: [register],
});

const commandTotal = new (require("prom-client").Counter)({
  name: 'charlybot_commands_total',
  help: 'Total commands executed',
  labelNames: ['command', 'status'],
  registers: [register],
});

const app = express();
const startTime = Date.now();

app.get("/health", (req, res) => {
  const valkey = getValkeyClient();
  res.json({
    status: "ok",
    discord: "connected",
    valkey: valkey.isConnected() ? "connected" : "disconnected",
    circuitState: valkey.circuitState,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

app.get("/metrics", async (req, res) => {
  // Update circuit state gauge before returning metrics
  try {
    const valkey = getValkeyClient();
    const state = valkey.circuitState;
    valkeyCircuitGauge.set(state === 'closed' ? 0 : state === 'open' ? 1 : 2);
  } catch {
    valkeyCircuitGauge.set(1); // Unknown = open
  }

  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

export function startHealthServer(port = 3001): void {
  app.listen(port, () => {
    console.log(`Health server listening on port ${port}`);
  });
}

export { commandDuration, commandTotal, errorCounter, valkeyCircuitGauge, prismaQueryHistogram };
