import client from "prom-client";

export function createMetricsRegistry() {
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const errorCounter = new client.Counter({
    name: 'charlybot_errors_total',
    help: 'Total errors by app and type',
    labelNames: ['app', 'type'],
    registers: [register],
  });

  const valkeyCircuitGauge = new client.Gauge({
    name: 'charlybot_valkey_circuit_state',
    help: 'Valkey circuit breaker state (0=closed, 1=open, 2=half-open)',
    registers: [register],
  });

  const prismaQueryHistogram = new client.Histogram({
    name: 'charlybot_prisma_query_duration_seconds',
    help: 'Prisma query duration',
    labelNames: ['operation'],
    registers: [register],
  });

  return { register, errorCounter, valkeyCircuitGauge, prismaQueryHistogram };
}