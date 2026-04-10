// Valkey configuration loader
// Loads config from environment with validation

import {
  type ValkeyConfig,
  DEFAULT_VALKEY_CONFIG,
} from './types.ts';

export function loadValkeyConfig(): ValkeyConfig {
  const config: ValkeyConfig = {
    host: process.env.VALKEY_HOST ?? DEFAULT_VALKEY_CONFIG.host,
    port: parseInt(process.env.VALKEY_PORT ?? `${DEFAULT_VALKEY_CONFIG.port}`, 10),
    password: process.env.VALKEY_PASSWORD,
    connectTimeoutMs: parseInt(
      process.env.VALKEY_CONNECT_TIMEOUT_MS ??
        `${DEFAULT_VALKEY_CONFIG.connectTimeoutMs}`,
      10,
    ) ?? DEFAULT_VALKEY_CONFIG.connectTimeoutMs,
    commandTimeoutMs: parseInt(
      process.env.VALKEY_COMMAND_TIMEOUT_MS ??
        `${DEFAULT_VALKEY_CONFIG.commandTimeoutMs}`,
      10,
    ) ?? DEFAULT_VALKEY_CONFIG.commandTimeoutMs,
    maxRetries: parseInt(
      process.env.VALKEY_MAX_RETRIES ??
        `${DEFAULT_VALKEY_CONFIG.maxRetries}`,
      10,
    ),
    prefix: process.env.VALKEY_PREFIX ?? DEFAULT_VALKEY_CONFIG.prefix,
    env: process.env.VALKEY_ENV ?? DEFAULT_VALKEY_CONFIG.env,
  } as const;

  // Validation
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid VALKEY_PORT: ${config.port}`);
  }

  if ((config.connectTimeoutMs ?? 0) < 100) {
    throw new Error(`VALKEY_CONNECT_TIMEOUT_MS must be >= 100`);
  }

  if ((config.commandTimeoutMs ?? 0) < 100) {
    throw new Error(`VALKEY_COMMAND_TIMEOUT_MS must be >= 100`);
  }

  return config;
}

export function getKeyPrefix(config: ValkeyConfig): string {
  return config.prefix ?? DEFAULT_VALKEY_CONFIG.prefix;
}