# 🎵 Sistema de Música - Comandos

Esta documentación describe los comandos de música implementados en el bot y cómo funcionan.

## 📋 Comandos Disponibles

### `/join`
Une el bot a tu canal de voz actual.

**Uso:**
```
/join
```

**Requisitos:**
- Debes estar conectado a un canal de voz
- El bot debe tener permisos de `Connect` y `Speak` en el canal
- Solo funciona en servidores (no en DMs)

**Comportamiento:**
- Si el bot ya está en el mismo canal, no hace nada
- Si el bot está en otro canal, se mueve al tuyo
- Crea una cola de música para el servidor si no existe

**Respuestas:**
- ✅ `Me uní a **[nombre del canal]**` - Éxito
- ❌ `Debes estar en un canal de voz para usar este comando` - No estás en un canal de voz
- ❌ `No tengo permisos para conectarme o hablar en ese canal de voz` - Faltan permisos

---

### `/leave`
Hace que el bot salga del canal de voz y detiene toda la música.

**Uso:**
```
/leave
```

**Requisitos:**
- El bot debe estar conectado a un canal de voz en el servidor
- Solo funciona en servidores (no en DMs)

**Comportamiento:**
- Detiene cualquier música que esté reproduciéndose
- Limpia completamente la cola de canciones
- Desconecta al bot del canal de voz
- Libera todos los recursos de audio

**Respuestas:**
- 👋 `Salí de **[nombre del canal]**` - Éxito
- ❌ `No estoy en ningún canal de voz` - El bot no está conectado

---

## 🏗️ Arquitectura del Sistema

### Servicios

#### `MusicService`
Servicio singleton que maneja todas las operaciones de voz y música.

**Métodos principales:**
- `join(guildId, voiceChannel, textChannel)` - Conecta el bot a un canal de voz
- `leave(guildId)` - Desconecta el bot y limpia recursos
- `getQueue(guildId)` - Obtiene la cola de música de un servidor
- `clearQueue(guildId)` - Limpia completamente la cola de un servidor

**Características:**
- Mantiene un mapa de colas por servidor (`Map<guildId, MusicQueue>`)
- Maneja reconexiones automáticas
- Limpia recursos automáticamente en caso de error

### Tipos de Datos

#### `MusicQueue`
Estructura que contiene toda la información de música de un servidor:
```typescript
{
  guildId: string;
  textChannel: TextChannel;
  voiceChannel: VoiceChannel | StageChannel;
  connection: VoiceConnection | null;
  player: AudioPlayer | null;
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  loopMode: LoopMode;
  history: Song[];
}
```

#### `Song`
Información de una canción:
```typescript
{
  title: string;
  url: string;
  duration: number;
  thumbnail?: string;
  requester: {
    id: string;
    username: string;
  };
}
```

---

## 🎯 Eventos

### `voiceStateUpdate`
Detecta cuando el bot es desconectado del canal de voz.

**Comportamiento:**
- Si el bot es expulsado o desconectado manualmente del canal
- Limpia automáticamente toda la cola de música
- Libera recursos de conexión y audio
- Registra el evento en los logs

**Condiciones:**
```typescript
if (
  oldState.member?.user.bot &&
  oldState.member?.user.id === oldState.client.user?.id &&
  oldState.channel &&
  !newState.channel
)
```

---

## 🔧 Dependencias

El sistema de música utiliza las siguientes librerías:

- **`@discordjs/voice`** (v0.19.0) - Manejo de conexiones de voz y audio
- **`play-dl`** (v1.9.7) - Descarga y streaming de audio (para futuros comandos)
- **`discord.js`** (v14.24.2) - Interacciones con Discord

---

## 📝 Logs

Todos los comandos y eventos de música son registrados usando Winston:

**Comandos:**
```typescript
logCommand(userId, guildId, commandName);
```

**Eventos importantes:**
- Conexión exitosa al canal de voz
- Desconexión del canal de voz
- Errores de conexión
- Limpieza de cola por desconexión

---

## 🚀 Próximos Comandos (Planificados)

Los siguientes comandos están planificados para futuras implementaciones:

### Control Básico
- `/play <canción>` - Reproduce una canción o la agrega a la cola
- `/pause` - Pausa la reproducción
- `/resume` - Reanuda la reproducción
- `/stop` - Detiene y limpia la cola
- `/skip` - Salta a la siguiente canción

### Gestión de Cola
- `/queue` - Muestra la lista de canciones
- `/nowplaying` - Muestra la canción actual
- `/shuffle` - Mezcla la cola
- `/clear` - Limpia la cola sin detener la canción actual
- `/remove <posición>` - Elimina una canción de la cola

### Avanzados
- `/loop <none|song|queue>` - Configura el modo de repetición
- `/volume <0-100>` - Ajusta el volumen
- `/playlist <url>` - Agrega una playlist completa
- `/search <query>` - Busca canciones y elige

---

## 🐛 Debug

Para probar los comandos en desarrollo:

1. Iniciar el bot:
```bash
bun run dev
```

2. Registrar comandos:
```bash
bun run rc
```

3. Listar comandos registrados:
```bash
bun run lc
```

---

## ⚠️ Notas Importantes

- Las colas de música son **por servidor**, no globales
- Si el bot pierde conexión, la cola se limpia automáticamente
- El bot necesita los permisos `Connect` y `Speak` en los canales de voz
- Los canales de tipo `GuildVoice` y `GuildStageVoice` son soportados
- El servicio usa el patrón Singleton para mantener estado consistente

---

## 📚 Referencias

- [Discord.js Voice Documentation](https://discordjs.guide/voice/)
- [@discordjs/voice GitHub](https://github.com/discordjs/voice)
- [play-dl Documentation](https://play-dl.github.io/)