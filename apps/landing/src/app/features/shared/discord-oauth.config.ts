/**
 * Discord OAuth invite configuration shared across all Landing CTA sections.
 * Centralizes client_id and minimum required permissions to avoid inconsistencies.
 *
 * Permissions (integer: 380134359170) includes:
 * Send Messages, Manage Messages, Embed Links, Attach Files, Read Message History,
 * Connect, Speak, Use External Emojis, Add Reactions, Manage Roles,
 * Kick Members, Ban Members, Manage Channels.
 *
 * Does NOT include Administrator (bit 3 = 8) — least privilege principle.
 */
export const DISCORD_CLIENT_ID = '695823543069311116';
export const DISCORD_PERMISSIONS = '380134359170';

export const DISCORD_OAUTH_URL = (() => {
  const base = 'https://discord.com/oauth2/authorize';
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    scope: 'bot',
    permissions: DISCORD_PERMISSIONS,
  });
  return `${base}?${params.toString()}`;
})();