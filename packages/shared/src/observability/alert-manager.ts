export type AlertType = 'error_spike' | 'circuit_open' | 'db_failure' | 'valkey_unreachable' | 'api_unreachable';

export interface AlertConfig {
  webhookUrl: string;
  cooldowns?: Partial<Record<AlertType, number>>; // ms
  enabled?: boolean;
}

const DEFAULT_COOLDOWNS: Record<AlertType, number> = {
  error_spike: 5 * 60 * 1000,
  circuit_open: 60 * 1000,
  db_failure: 2 * 60 * 1000,
  valkey_unreachable: 2 * 60 * 1000,
  api_unreachable: 3 * 60 * 1000,
};

export class AlertManager {
  private webhookUrl: string;
  private cooldowns: Record<AlertType, number>;
  private lastSent: Map<AlertType, number> = new Map();
  private enabled: boolean;

  constructor(config: AlertConfig) {
    this.webhookUrl = config.webhookUrl;
    this.cooldowns = { ...DEFAULT_COOLDOWNS, ...config.cooldowns };
    this.enabled = config.enabled ?? true;
  }

  async alert(type: AlertType, message: string, details?: Record<string, unknown>): Promise<void> {
    if (!this.enabled) return;

    const now = Date.now();
    const last = this.lastSent.get(type) ?? 0;
    const cooldown = this.cooldowns[type];

    if (now - last < cooldown) return; // Cooldown active

    this.lastSent.set(type, now);

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `🚨 Alert: ${type}`,
            description: message,
            color: 0xff0000,
            fields: details ? Object.entries(details).map(([k, v]) => ({ name: k, value: String(v) })) : [],
            timestamp: new Date().toISOString(),
          }],
        }),
      });
    } catch (error) {
      // Don't throw — alerting should not crash the app
      console.error('AlertManager: failed to send alert', error);
    }
  }
}