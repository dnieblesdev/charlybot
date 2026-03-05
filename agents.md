# agents.md — CharlyBot

Contexto para agentes de IA que trabajen en este proyecto.
Leer COMPLETO antes de generar cualquier código.

---

## Qué es este proyecto

Bot de Discord multifuncional construido con **TypeScript + Bun + Discord.js v14**.
Corre en un único proceso. No tiene frontend. No tiene API pública.

**Runtime:** Bun (no Node.js — usar APIs de Bun cuando sea posible)
**Lenguaje:** TypeScript strict
**ORM:** Prisma 7 con adapter LibSQL → SQLite (`dev.db`)
**Logs:** Winston (`src/utils/logger.ts`)

---

## Sistemas del bot

| Sistema | Qué hace | Comandos principales |
|---|---|---|
| **Música** | Reproduce YouTube/Spotify vía `play-dl` + `yt-dlp` con cola, loops, shuffle | `/play`, `/skip`, `/queue`, `/nowplaying`, `/pause`, `/resume`, `/stop`, `/loop`, `/shuffle`, `/volume`, `/join`, `/leave` |
| **Verificación** | Panel con botón → modal de registro → revisión de moderador → asignación de rol | `/setup-verification`, `/send-verification-panel`, `/list-pending-verifications` |
| **AutoRole** | Asignación de roles por reacción o botón en mensajes configurables | `/autorole setup/listar/editar/remover` |
| **Economía** | Wallet por servidor, banco global, trabajo, crimen, robo, ruleta, leaderboard | `/work`, `/crime`, `/rob`, `/balance`, `/deposit`, `/retirar`, `/ruleta`, `/leaderboard`, `/bail` |
| **Config** | Configuración por servidor (canales de log, bienvenida, verificación, etc.) | `/set-welcome`, `/set-voice-log-channel`, `/set-image-channel`, `/show-config` |
| **Logs** | Eventos de voz, entrada/salida de miembros, mensajes | Automático vía events |
| **Clases** | Sistema de roles jerárquicos (tipo → clase → subclase) para juegos de rol | `/addClass`, `/listClasses`, `/removeClass` |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── core/
│   │   ├── DiscordClient.ts     ← Clase que wrappea discord.js Client
│   │   └── index.ts             ← Entry point: configura ffmpeg, Spotify, arranca el bot
│   ├── commands/                ← Comandos slash
│   │   ├── autorole/            ← PATRÓN ESTÁNDAR (ver abajo)
│   │   │   ├── index.ts         ← SlashCommandBuilder + router de subcomandos
│   │   │   ├── setup.ts         ← Lógica del subcomando "setup"
│   │   │   ├── listar.ts        ← Lógica del subcomando "listar"
│   │   │   ├── editar.ts        ← Lógica del subcomando "editar"
│   │   │   └── remover.ts       ← Lógica del subcomando "remover"
│   │   └── *.ts                 ← Comandos legacy (un archivo por comando) — NO agregar más así
│   ├── events/                  ← Event handlers de Discord.js
│   │   ├── interactionCreate.ts ← Router central de interacciones (botones, modales, selects, slash)
│   │   ├── ready.ts
│   │   ├── guildMemberAdd.ts
│   │   ├── guildMemberRemove.ts
│   │   ├── voiceStateUpdate.ts
│   │   ├── messageCreate.ts
│   │   ├── messageReactionAdd.ts
│   │   ├── messageReactionRemove.ts
│   │   └── guildCreate.ts
│   ├── services/                ← Lógica de negocio (sin imports de discord.js cuando sea posible)
│   │   ├── MusicService.ts      ← Singleton, maneja colas por guildId
│   │   ├── AutoRoleService.ts   ← Funciones puras para asignar/quitar roles
│   │   ├── VerificationHandler.ts
│   │   ├── ImageService.ts
│   │   └── economy/
│   │       ├── EconomyService.ts
│   │       ├── EconomyConfigService.ts
│   │       ├── LeaderboardService.ts
│   │       └── RouletteService.ts
│   └── loader.ts                ← Carga dinámica de commands y events al iniciar
├── config/
│   ├── repositories/            ← Acceso a la base de datos (una función por operación)
│   │   ├── GuildConfigRepo.ts
│   │   ├── AutoRoleRepo.ts
│   │   ├── VerificationRepo.ts
│   │   └── ClassRolesRepo.ts
│   ├── models/                  ← Tipos/interfaces de configuración
│   └── music.ts                 ← Constantes y config del sistema de música
├── infrastructure/
│   └── storage/
│       ├── prismaClient.ts      ← Instancia singleton de PrismaClient (exporta `prisma`)
│       ├── PrismaStorage.ts     ← Clase genérica CRUD sobre Prisma (con cache opcional)
│       ├── SimpleStorage.ts     ← LEGACY: storage JSON en archivos. NO usar para features nuevas.
│       └── index.ts             ← Re-exporta todo
├── adapters/
│   ├── StorageAdapter.ts        ← Vacío. Deuda técnica del intento de abstracción previo.
│   └── AudioAdapter.ts          ← Vacío. Deuda técnica.
├── types/                       ← Tipos TypeScript del dominio (music, etc.)
├── utils/
│   └── logger.ts                ← Winston logger. Usar siempre en vez de console.log.
├── generated/
│   └── prisma/                  ← Generado por Prisma. NUNCA editar manualmente.
└── container.ts                 ← Vacío. Deuda técnica del intento de DI previo.
```

---

## Patrón estándar para comandos — OBLIGATORIO

Todo comando nuevo debe seguir la estructura de `src/app/commands/autorole/`:

```
src/app/commands/<nombre-del-comando>/
├── index.ts          ← SlashCommandBuilder + export { data, execute } + router
├── <subcomando1>.ts  ← export async function execute(interaction)
├── <subcomando2>.ts
└── ...
```

### `index.ts` — estructura mínima

```typescript
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { execute as subcomando1 } from "./subcomando1";

export const data = new SlashCommandBuilder()
  .setName("nombre")
  .setDescription("Descripción")
  .addSubcommand((sub) =>
    sub.setName("subcomando1").setDescription("Hace X")
  );

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

- `data` y `execute` son exports nombrados obligatorios — el loader los detecta así
- Si el comando tiene `init(client)`, se llama al arrancar (útil para recuperar estado)
- Para respuestas privadas: siempre usar `flags: [MessageFlags.Ephemeral]` — importar `MessageFlags` desde `discord.js`
- **NUNCA** usar `ephemeral: true` — está deprecado en Discord.js v14 moderno
- Siempre hacer `defer` antes de operaciones async largas: `await interaction.deferReply()`
- Los permisos se definen en `SlashCommandBuilder` con `setDefaultMemberPermissions()`

---

## Base de datos

**Motor:** SQLite (archivo `dev.db` en raíz del proyecto y en `prisma/`)
**ORM:** Prisma 7 con adapter LibSQL (`@prisma/adapter-libsql`)
**Schema:** `prisma/schema.prisma`
**Client generado:** `src/generated/prisma/`

### Cómo acceder a la DB

Siempre importar desde `src/infrastructure/storage/`:

```typescript
import { prisma } from "../../infrastructure/storage";
```

O usar `PrismaStorage` para operaciones CRUD genéricas:

```typescript
import { prisma, PrismaStorage } from "../../infrastructure/storage";

const storage = new PrismaStorage<MiModelo>({
  prismaClient: prisma,
  modelName: "miModelo",    // nombre del modelo en camelCase como en Prisma
  enableCache: true,
  cacheTTL: 300000,         // 5 minutos en ms
});
```

### Modelos disponibles

| Modelo | Propósito |
|---|---|
| `Guild` | Metadata del servidor (nombre, owner, member count) |
| `GuildConfig` | Configuración por servidor (canales, roles) |
| `UserEconomy` | Wallet por usuario+servidor (pocket, jail, cooldowns) |
| `GlobalBank` | Banco global compartido entre servidores (por userId) |
| `RouletteGame` / `RouletteBet` | Partidas y apuestas de ruleta |
| `EconomyConfig` | Configuración de economía por servidor |
| `Leaderboard` | Cache de ranking por servidor |
| `AutoRole` / `RoleMapping` | Configuración de auto-roles por mensaje |
| `tipoClase` / `classes` / `subclass` | Jerarquía de clases para sistema de roles de juego |

### Repositories

Para features nuevas que requieran acceso a DB, crear el repository en `src/config/repositories/`:

```typescript
// src/config/repositories/MiFeatureRepo.ts
import { prisma } from "../../infrastructure/storage";

export async function getMiDato(guildId: string) {
  return prisma.miModelo.findUnique({ where: { guildId } });
}
```

**NO** acceder directamente a `prisma` desde commands o services — siempre ir a través de un repository.

---

## Manejo de interacciones (botones, modales, select menus)

El router central está en `src/app/events/interactionCreate.ts`.

Si el nuevo comando genera botones, modales o select menus con `customId` propio, hay que registrar el handler en ese archivo.

### Convención de `customId`

```
<feature>_<accion>_<id_opcional>

Ejemplos:
  "autorole_setup"
  "verification_approve_userId123"
  "economia_confirmar_apuesta"
```

---

## Logger

Siempre usar el logger de Winston en vez de `console.log`:

```typescript
import logger from "../../utils/logger";

logger.info("Mensaje informativo", { contexto: "datos adicionales" });
logger.warn("Advertencia");
logger.error("Error", { error: error instanceof Error ? error.message : String(error) });
logger.debug("Debug detallado");  // Solo aparece en desarrollo
```

---

## Deuda técnica — NO usar ni extender

Estos archivos existen pero están vacíos o son legacy. No basar nuevas features en ellos:

- `src/adapters/StorageAdapter.ts` — vacío, intento abandonado de abstracción de storage
- `src/adapters/AudioAdapter.ts` — vacío
- `src/container.ts` — vacío, intento abandonado de dependency injection
- `src/infrastructure/storage/SimpleStorage.ts` — LEGACY, guardaba datos en JSON planos. Ya no se usa para features nuevas. Toda la persistencia es vía Prisma.

---

## Variables de entorno

Definidas en `.env` (ver `.env.example`):

| Variable | Requerida | Descripción |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Token del bot |
| `CLIENT_ID` | ✅ | Application ID del bot |
| `GUILD_ID` | ❌ | Guild ID para comandos de desarrollo |
| `DATABASE_URL` | ❌ | Ruta a la DB SQLite (default: `file:./dev.db`) |
| `SPOTIFY_CLIENT_ID` | ❌ | Para soporte de Spotify en música |
| `SPOTIFY_CLIENT_SECRET` | ❌ | Para soporte de Spotify en música |
| `SPOTIFY_REFRESH_TOKEN` | ❌ | Para soporte de Spotify en música |

---

## Scripts útiles

```bash
bun run dev          # Inicia el bot en modo desarrollo
bun run rc           # Registra los slash commands en Discord  → scripts/registerCommands.ts
bun run cc           # Limpia los slash commands registrados   → scripts/clearCommands.ts
bun run lc           # Lista los comandos registrados          → scripts/listRegistered.ts
bunx prisma migrate dev   # Crea y aplica una migración nueva
bunx prisma studio        # GUI para inspeccionar la base de datos
```

> Los scripts de administración de comandos viven en `scripts/` (no en `src/`). Son ejecutables directos con Bun, no comandos del bot.

---

## Skills disponibles

| Skill | Descripción | Archivo |
|---|---|---|
| `discord-command` | Crea un comando slash siguiendo la convención del proyecto (carpeta + index.ts + subcomandos) | [skills/discord-command/SKILL.md](skills/discord-command/SKILL.md) |

---

## Checklist para agregar una feature nueva

1. **¿Necesita persistencia?** → Agregar modelo en `prisma/schema.prisma` + migrar + crear repository en `src/config/repositories/`
2. **¿Tiene lógica de negocio compleja?** → Crear service en `src/app/services/`
3. **¿Es un comando slash?** → Crear carpeta en `src/app/commands/<nombre>/` con `index.ts` + archivos por subcomando
4. **¿Genera botones/modales/selects?** → Registrar el handler en `src/app/events/interactionCreate.ts` con `customId` prefijado por la feature
5. **¿Necesita escuchar eventos de Discord?** → Agregar o modificar el event handler correspondiente en `src/app/events/`
6. **Logs:** Siempre usar `logger` de Winston, nunca `console.log`
7. **Tipos:** Definir interfaces/tipos en `src/types/` si son compartidos entre múltiples archivos
