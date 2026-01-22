# 🤖 Charlybot

Bot de Discord multifuncional con sistema de música, logs y verificación de usuarios.

## 🚀 Inicio Rápido

### Instalación

```bash
bun install
```

### Ejecución

```bash
# Modo desarrollo
bun run dev

# Registrar comandos
bun run rc

# Limpiar comandos
bun run cc

# Listar comandos registrados
bun run lc
```

## ✨ Características

### 🎵 Sistema de Música
- Reproducción de música desde YouTube, Spotify y más
- Cola de reproducción
- Controles: play, pause, skip, queue, shuffle, loop
- Soporte para playlists

### 🔐 Sistema de Verificación
- Panel de verificación con botones interactivos
- Formularios modales para registro de usuarios
- Revisión manual por moderadores
- Asignación automática de roles
- Cambio automático de apodos según nombre en el juego
- Notificaciones por DM

**📖 Guía Rápida:** [QUICK_START_VERIFICATION.md](QUICK_START_VERIFICATION.md)  
**📚 Documentación Completa:** [VERIFICATION_SYSTEM.md](VERIFICATION_SYSTEM.md)

### 📊 Sistema de Logs
- Logs de entrada/salida de usuarios
- Logs de cambios en canales de voz
- Logs de mensajes y eventos

### 🖼️ Gestión de Imágenes
- Subida de imágenes a canales específicos
- Validación automática de archivos

## 📋 Comandos Principales

### Verificación
- `/setup-verification` - Configura el sistema de verificación
- `/send-verification-panel` - Envía el panel de verificación
- `/list-pending-verifications` - Lista solicitudes pendientes

### Música
- `/play` - Reproduce música
- `/pause` / `/resume` - Pausa/reanuda reproducción
- `/skip` - Salta a la siguiente canción
- `/queue` - Muestra la cola de reproducción
- `/nowplaying` - Muestra la canción actual

### Configuración
- `/set-welcome` - Configura mensajes de bienvenida
- `/set-image-channel` - Configura canal de imágenes
- `/set-voice-log-channel` - Configura logs de voz
- `/show-config` - Muestra la configuración actual

## 🛠️ Tecnologías

- **Runtime:** Bun
- **Framework:** Discord.js v14
- **Lenguaje:** TypeScript
- **Audio:** @discordjs/voice, play-dl, yt-dlp-wrap
- **Logs:** Winston

## 📁 Estructura del Proyecto

```
charlybot/
├── src/
│   ├── app/
│   │   ├── commands/         # Comandos del bot
│   │   ├── events/           # Manejadores de eventos
│   │   └── services/         # Lógica de negocio
│   ├── config/
│   │   └── repositories/     # Almacenamiento de datos
│   ├── infrastructure/       # Servicios de infraestructura
│   └── utils/               # Utilidades
├── data/                    # Base de datos JSON
└── logs/                    # Archivos de logs
```

## 🔧 Configuración

1. Crea un archivo `.env` con:
```env
DISCORD_TOKEN=tu_token_aqui
CLIENT_ID=tu_client_id
GUILD_ID=tu_guild_id_opcional
```

2. Registra los comandos:
```bash
bun run rc
```

3. Inicia el bot:
```bash
bun run dev
```

## 📖 Documentación

- [Sistema de Verificación - Guía Rápida](QUICK_START_VERIFICATION.md)
- [Sistema de Verificación - Documentación Completa](VERIFICATION_SYSTEM.md)
- [Comandos de Música](MUSIC_COMMANDS.md)
- [Sistema de Logs de Voz](VOICE_LOGS.md)

## 🤝 Contribuir

Este proyecto está en desarrollo activo. Si encuentras errores, revisa los logs en la carpeta `logs/`.

## 📝 Licencia

Este proyecto fue creado usando Bun v1.2.21. [Bun](https://bun.com) es un runtime de JavaScript rápido y todo en uno.
