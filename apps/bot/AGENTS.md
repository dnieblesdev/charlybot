# AGENTS.md — CharlyBot Bot (`apps/bot`)

Contexto para agentes de IA que trabajen en el bot. Leelo completo antes de generar cualquier cambio.

## TL;DR

- Stack: **TypeScript + Bun + Discord.js v14**.
- Entry real: `src/index.ts` (importa `src/app/core/index.ts`).
- Comandos nuevos: carpeta + `index.ts` + subcomandos (patrón `src/app/commands/autorole/`).
- Interacciones: `customId` SIEMPRE via `CUSTOM_IDS.*` (no strings hardcodeadas).
- Respuestas privadas: `flags: [MessageFlags.Ephemeral]` (NUNCA `ephemeral: true`).
- Persistencia: el bot consume la **API HTTP** (adapters en `src/infrastructure/api/*`).

## Qué Es Este Proyecto

Bot de Discord multifuncional.

- Runtime: Bun
- Lenguaje: TypeScript (ESM)
- Discord: Discord.js v14
- Logs: Winston (`src/utils/logger.ts`)

## Sistemas Del Bot

| Sistema | Qué hace | Comandos principales |
|---|---|---|
| Música | Reproduce YouTube/Spotify vía `play-dl` + `yt-dlp` con cola, loops, shuffle | `/play`, `/skip`, `/queue`, `/nowplaying`, `/pause`, `/resume`, `/stop`, `/loop`, `/shuffle`, `/volume`, `/join`, `/leave` |
| Verificación | Panel con botón → modal de registro → revisión de moderador → asignación de rol | `/setup-verification`, `/send-verification-panel`, `/list-pending-verifications` |
| AutoRole | Asignación de roles por reacción o botón en mensajes configurables | `/autorole setup/listar/editar/remover` |
| Economía | Wallet por servidor, banco global, trabajo, crimen, robo, ruleta, leaderboard | `/work`, `/crime`, `/rob`, `/balance`, `/deposit`, `/retirar`, `/ruleta`, `/leaderboard`, `/bail` |
| Config | Configuración por servidor (canales de log, bienvenida, verificación, etc.) | `/set-welcome`, `/set-voice-log-channel`, `/set-image-channel`, `/show-config` |
| Logs | Eventos de voz, entrada/salida de miembros, mensajes | Automático vía events |
| Clases | Sistema de roles jerárquicos (tipo → clase → subclase) | `/addClass`, `/listClasses`, `/removeClass` |

## Estructura (Real)

```
src/
  index.ts                     ← importa app/core/index.ts
  app/
    core/
      DiscordClient.ts         ← wrapper de discord.js Client
      index.ts                 ← bootstrap: ffmpeg/Spotify, Valkey/streams, arranque
    loader.ts                  ← carga dinámica de commands y events
    commands/                  ← slash commands
    events/                    ← event handlers (router de interacciones en interactionCreate.ts)
    interactions/
      customIds.ts             ← CUSTOM_IDS, FEATURES, parseCustomId()
      handlers/
    services/                  ← lógica de negocio
  infrastructure/
    api/                       ← client HTTP + adapters hacia apps/api
    valkey/                    ← lifecycle Valkey (wrapper con fallback)
    streams/                   ← streams de música (Valkey)
    storage/                   ← hoy no se usa (ver deuda técnica)
  config/
    repositories/              ← boundary de acceso a datos (hoy via API adapters)
  utils/
    logger.ts                  ← Winston logger (usar siempre)
  types/
```

## Do / Don’t (Agentes)

### Do

- Usá el patrón de comandos por carpeta (ver abajo).
- Antes de operaciones async largas, hacé `await interaction.deferReply(...)`.
- Usá `CUSTOM_IDS.*` + `parseCustomId()` para interacciones.
- Usá `logger` (Winston) en vez de `console.log`.

### Don’t

- **NUNCA** uses `ephemeral: true` (deprecado). Usá `flags: [MessageFlags.Ephemeral]`.
- No hardcodees strings de `customId`.
- No agregues comandos legacy como archivo plano en `src/app/commands/*.ts`.
- No intentes conectar Prisma desde el bot (en el código actual, el bot habla con la API).

## Patrón Estándar Para Comandos (OBLIGATORIO)

Todo comando nuevo debe seguir la estructura de `src/app/commands/autorole/`:

```
src/app/commands/<nombre-del-comando>/
  index.ts          ← SlashCommandBuilder + export { data, execute } + router
  <subcomando1>.ts  ← export async function execute(interaction)
  <subcomando2>.ts
```

### `index.ts` (estructura mínima)

```ts
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { execute as subcomando1 } from "./subcomando1";

export const data = new SlashCommandBuilder()
  .setName("nombre")
  .setDescription("Descripción")
  .addSubcommand((sub) => sub.setName("subcomando1").setDescription("Hace X"));

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  switch (subcommand) {
    case "subcomando1":
      await subcomando1(interaction);
      break;
  }
}
```

### Reglas de comandos

- `data` y `execute` son exports nombrados obligatorios (el loader los detecta así).
- Si el comando expone `init(client)`, se llama al arrancar (útil para recuperar estado).
- Para respuestas privadas: siempre `flags: [MessageFlags.Ephemeral]`.
- **NUNCA** `ephemeral: true`.
- Para tareas largas: `await interaction.deferReply(...)`.

## Manejo de Interacciones (botones, modales, selects)

Router central: `src/app/events/interactionCreate.ts`.

### Convención de `customId`

Formato: `feature:action[:payload]`

- `:` es el único separador estructural.
- `_` puede existir dentro del payload pero no como separador.

Regla: **NUNCA** hardcodear strings. Siempre usar `CUSTOM_IDS.*` de `src/app/interactions/customIds.ts`.

```ts
import { CUSTOM_IDS, parseCustomId } from "../../interactions/customIds";

new ButtonBuilder().setCustomId(CUSTOM_IDS.verification.APPROVE(userId));

const { feature, action, payload } = parseCustomId(interaction.customId);
```

Para agregar una feature nueva con interacciones:

1. Agregar constantes en `src/app/interactions/customIds.ts`.
2. Crear `src/app/interactions/handlers/<feature>.handler.ts`.
3. Registrar el handler en `src/app/events/interactionCreate.ts`.

## Datos y Repositories

En el código actual, el bot persiste/consulta datos via HTTP hacia `apps/api`.

- Client HTTP: `src/infrastructure/api/ApiClient.ts` (`API_URL` + `API_KEY`).
- Adapters HTTP: `src/infrastructure/api/*Adapter.ts`.
- Repositories: `src/config/repositories/*.ts` (API boundary para el resto del bot).

Regla: commands/services NO deberían hablar con la API directamente; usá repositories.

## Logger

Siempre usar Winston (`src/utils/logger.ts`) en vez de `console.log`.

```ts
import logger from "../../utils/logger";

logger.info("Mensaje informativo", { ctx: "algo" });
logger.warn("Advertencia");
logger.error("Error", { error: err instanceof Error ? err.message : String(err) });
```

## Valkey

El bot usa Valkey con fallback en memoria.

- Lifecycle: `src/infrastructure/valkey/index.ts`.
- Streams de música: `src/infrastructure/streams/*`.

Variables típicas: `VALKEY_HOST`, `VALKEY_PORT`, `VALKEY_PASSWORD`, `VALKEY_PREFIX`, `VALKEY_MAX_RETRIES`.

## Docker Dev

`docker/docker-compose.dev.yml` levanta `valkey`, `api` y `bot`.

## Variables de Entorno (mínimas)

- `DISCORD_TOKEN` (requerida)
- `CLIENT_ID` (requerida para scripts)
- `GUILD_ID`/`GUILD_ID2`/`GUILD_ID3` (opcionales; usados por scripts de registro)
- `API_URL` (default en código: `http://localhost:3000`)
- `API_KEY` (default en código: `dev-key`)
- `LOG_LEVEL`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`
- `VALKEY_*`

## Scripts Útiles

```bash
bun run dev          # Inicia el bot (apps/bot)
bun run rc           # Registra slash commands (scripts/registerCommands.ts)
bun run cc           # Limpia slash commands
bun run lc           # Lista slash commands registrados
```

Nota: los scripts de administración de comandos viven en `scripts/` (raíz) y se ejecutan con Bun.

## Deuda Técnica (No Extender)

- `src/adapters/StorageAdapter.ts` (vacío)
- `src/adapters/AudioAdapter.ts` (vacío)
- `src/container.ts` (vacío)
- `src/infrastructure/storage/index.ts` (hoy no se usa; el bot consume la API)

## Tests

El bot usa **vitest** como test runner con pool `forks` para aislamiento determinista. La configuración vive en `vitest.config.ts` y el setup global en `tests/setup.ts`.

### Ejecutar tests

```bash
# desde apps/bot/
bun test              # run once
bun run test:watch    # watch mode
bun run test:coverage # con coverage report (v8)
```

### Estructura de archivos

```
apps/bot/
  tests/
    setup.ts              # setup global: mock @charlybot/shared/prisma
    smoke.test.ts          # smoke test (verifica que vitest corre)
    economy/               # tests de lógica pura de ruleta
      roulette.test.ts
      config.test.ts
      service.test.ts
    commands/economia/
      balance.test.ts
  src/
    __mocks__/
      discord.ts           # createMockChatInputCommandInteraction()
      repo.ts              # createMockEconomyRepo(), createMockConfigRepo()
```

### Mock factories

**`createMockChatInputCommandInteraction(overrides?)`**
Crea un mock de `ChatInputCommandInteraction` con `reply()`, `editReply()`, `deferReply()`, `followUp()` como `vi.fn()`. Overridea `userId`, `guildId`, y `options.*` según necesidad.

```ts
const interaction = createMockChatInputCommandInteraction({
  userId: "my-user",
  guildId: "my-guild",
  options: { subcommand: "balance" },
});
await interaction.deferReply();
await interaction.editReply({ content: "result" });
```

**`createMockEconomyRepo(overrides?)`**
Crea un mock de todo el namespace `EconomyRepo` con cada función como `vi.fn()`. Comportamiento por defecto: `getEconomyUser` → `null`, `createEconomyUser` → usuario por defecto con pocket=1000. Overridea funciones específicas en cada test.

```ts
const repo = createMockEconomyRepo({
  getEconomyUser: vi.fn(() => Promise.resolve({ pocket: 5000 })),
});
```

### Patrón de test por capa

| Capa | Qué testear | Mock |
|------|-------------|------|
| Lógica pura (RouletteService) | Función directa, sin mocks | Ninguno |
| Config defaults | Servicio con repo mockeado | `vi.mock(".../EconomyRepo")` |
| Service con mocks | Servicio, repo y LeaderboardService mockeados | `vi.mock()` por namespace |
| Command handler | `execute(interaction)` con interaction mock | `createMockChatInputCommandInteraction` |

### Reglas importantes

- **No usar base de datos real** — todos los tests usan mocks de `EconomyRepo` y `vi.mock("@charlybot/shared")` para reemplazar `prisma`.
- **No `ephemeral: true`** — en tests de commands, si necesitás respuesta ephemeral, usar `flags: [MessageFlags.Ephemeral]`.
- **`vi.clearAllMocks()`** — se llama automáticamente en `afterEach` del setup global.
- **`import type`** — usar `import type` para tipos que solo se usan como tipos (requerido por `verbatimModuleSyntax`).

## Skills Disponibles

- `skills/discord-command/SKILL.md`: guía para crear comandos slash respetando el patrón del repo.
