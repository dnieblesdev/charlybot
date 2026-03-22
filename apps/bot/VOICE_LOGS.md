# 📢 Sistema de Logs de Canales de Voz

Esta funcionalidad permite registrar automáticamente cuando los usuarios entran, salen o cambian de canales de voz en tu servidor de Discord.

## 🎯 Características

- ✅ Detecta cuando un usuario **entra** a un canal de voz
- ✅ Detecta cuando un usuario **sale** de un canal de voz
- ✅ Detecta cuando un usuario **cambia** de un canal de voz a otro
- ✅ Muestra información detallada con embeds coloridos
- ✅ Incluye timestamp y ID del usuario
- ✅ Solo los administradores pueden configurar el canal de logs

## 📝 Comandos

### `/set-voice-log`

Configura el canal donde se enviarán los registros de entrada/salida de canales de voz.

**Parámetros:**
- `canal` (requerido): El canal de texto donde se enviarán los logs

**Permisos requeridos:** Administrador

**Ejemplo de uso:**
```
/set-voice-log canal:#logs-de-voz
```

### `/show-config`

Muestra la configuración actual del servidor, incluyendo el canal de logs de voz configurado.

**Parámetros:**
- `publico` (opcional): Si es `true`, muestra la configuración públicamente. Por defecto es `false` (solo visible para ti)

**Permisos requeridos:** Administrador

**Ejemplo de uso:**
```
/show-config publico:false
```

## 🎨 Tipos de Eventos

### 🟢 Usuario se une a un canal de voz
- **Color:** Verde
- **Información:** Nombre del usuario, canal al que se unió, hora y ID

### 🔴 Usuario sale de un canal de voz
- **Color:** Rojo
- **Información:** Nombre del usuario, canal del que salió, hora y ID

### 🟠 Usuario cambia de canal de voz
- **Color:** Naranja
- **Información:** Nombre del usuario, canal de origen, canal de destino, hora y ID

## 🔧 Configuración Inicial

1. Asegúrate de tener permisos de **Administrador** en el servidor
2. Crea o selecciona un canal de texto donde quieras recibir los logs
3. Ejecuta el comando `/set-voice-log` y selecciona el canal
4. ¡Listo! El bot comenzará a registrar automáticamente todos los movimientos en canales de voz

## 📋 Ejemplo de Embed de Log

```
🟢 @Usuario#1234 se unió a 🎤 General

Canal de voz: General
Timestamp: 2024-01-15 14:30:45
ID: 123456789012345678
```

## 🛠️ Implementación Técnica

### Archivos creados/modificados:

1. **`src/app/events/voiceStateUpdate.ts`**
   - Evento que escucha cambios en el estado de voz de los usuarios
   - Detecta entrada, salida y cambios de canal
   - Envía embeds formateados al canal configurado

2. **`src/app/commands/setVoiceLogChannel.ts`**
   - Comando slash para configurar el canal de logs
   - Solo accesible para administradores

3. **`src/config/repositories/GuildConfigRepo.ts`**
   - Función `setVoiceLogChannel()` para guardar la configuración
   - Almacena el ID del canal de logs en la base de datos

4. **`src/app/core/DiscordClient.ts`**
   - Agregado intent `GuildVoiceStates` para escuchar eventos de voz

## 🔐 Permisos Necesarios

El bot necesita los siguientes permisos:
- **Ver canales** - Para acceder a los canales de voz
- **Enviar mensajes** - Para enviar logs al canal configurado
- **Insertar enlaces** - Para mostrar los embeds correctamente

## ⚙️ Intents de Discord Requeridos

```typescript
GatewayIntentBits.GuildVoiceStates
```

Este intent ya está configurado automáticamente en el bot.

## 📚 Recursos Adicionales

- [Discord.js Voice State Documentation](https://discord.js.org/#/docs/discord.js/main/class/VoiceState)
- [Discord Gateway Intents](https://discord.com/developers/docs/topics/gateway#gateway-intents)

---

**Nota:** Para que los cambios surtan efecto, asegúrate de registrar los nuevos comandos usando:
```bash
bun run rc
```
