# 🔐 Sistema de Verificación de Usuarios

Este documento explica cómo funciona el sistema de verificación de usuarios en el bot y cómo configurarlo.

## 📋 Descripción General

El sistema de verificación permite controlar el acceso de nuevos usuarios al servidor. Cuando alguien se une:

1. **No tiene acceso a los canales** (configurado mediante permisos de Discord)
2. **Ve un canal de verificación** con un botón para iniciar el proceso
3. **Completa un formulario** con su información
4. **Los moderadores revisan** la solicitud
5. **Si se aprueba**, el usuario recibe un rol y acceso completo

## 🎯 Características

- ✅ Panel de verificación con embed informativo y botón interactivo
- 📝 Modal para que los usuarios proporcionen:
  - Nombre en el juego (se usará como apodo en el servidor)
  - Captura de pantalla de su perfil en el juego
- 👮 Canal de revisión donde los moderadores pueden aprobar/rechazar
- 🔄 Asignación automática de rol y cambio de apodo al aprobar
- 📬 Notificaciones por DM al usuario sobre el estado de su solicitud
- 📊 Sistema de logs completo

## 🛠️ Configuración Inicial

### Paso 1: Preparar el servidor

Antes de usar el bot, configura los permisos en tu servidor:

1. **Crea un rol "Verificado"** (o el nombre que prefieras)
2. **Configura los canales**:
   - Deja el canal de verificación visible para @everyone
   - Oculta los demás canales, dejándolos visibles solo para el rol "Verificado"
3. **Crea un canal para moderadores** donde revisarán las solicitudes

### Paso 2: Configurar el bot

1. **Registra los comandos** (si aún no lo has hecho):
   ```bash
   bun run rc
   ```

2. **Configura el sistema de verificación**:
   ```
   /setup-verification
     verification-channel: #verificación (canal donde los usuarios se verificarán)
     review-channel: #solicitudes-verificacion (canal privado para moderadores)
     verified-role: @Verificado (rol que se asignará)
   ```

3. **Envía el panel de verificación**:
   ```
   /send-verification-panel
   ```

   Esto enviará un embed con un botón al canal de verificación configurado.

## 📖 Uso

### Para Usuarios

1. **Ingresa al servidor** y ve al canal de verificación
2. **Haz clic en el botón "Verificarme"**
3. **Completa el formulario**:
   - **Nombre en el juego**: Tu nickname en el juego
   - **Captura de pantalla**: Sube la imagen a Discord primero, luego haz clic derecho → "Copiar enlace" y pega la URL
4. **Espera la revisión** de un moderador
5. **Recibirás una notificación** cuando tu solicitud sea procesada

### Para Moderadores

1. **Revisa las solicitudes** en el canal de revisión configurado
2. **Verifica la información**:
   - Nombre de usuario de Discord
   - Nombre en el juego proporcionado
   - Captura de pantalla del perfil
3. **Haz clic en**:
   - ✅ **Aprobar**: Asigna el rol y cambia el apodo del usuario
   - ❌ **Rechazar**: Notifica al usuario que su solicitud fue rechazada

## 🎨 Personalización

### Modificar el mensaje del panel

Edita el archivo `src/app/commands/sendVerificationPanel.ts` y modifica el contenido del embed:

```typescript
const embed = new EmbedBuilder()
  .setTitle("🔐 Verificación de Usuario")
  .setDescription(
    "Tu mensaje personalizado aquí..."
  )
  .setColor(0x00ff00); // Color en hexadecimal
```

### Cambiar el estilo del botón

En el mismo archivo, puedes cambiar:

```typescript
const button = new ButtonBuilder()
  .setCustomId("verification_start")
  .setLabel("Tu texto aquí") // Cambia el texto
  .setEmoji("🎮") // Cambia el emoji
  .setStyle(ButtonStyle.Primary); // Primary, Success, Danger, Secondary
```

## 📁 Archivos del Sistema

### Comandos
- `src/app/commands/setupVerification.ts` - Configuración del sistema
- `src/app/commands/sendVerificationPanel.ts` - Enviar panel de verificación

### Servicios
- `src/app/services/VerificationHandler.ts` - Lógica de manejo de verificaciones

### Repositorios
- `src/config/repositories/VerificationRepo.ts` - Almacenamiento de solicitudes
- `src/config/repositories/GuildConfigRepo.ts` - Configuración del servidor (actualizado)

### Eventos
- `src/app/events/interactionCreate.ts` - Manejo de interacciones (actualizado)

### Datos
- `data/verifications.json` - Base de datos de solicitudes (se crea automáticamente)
- `data/config.json` - Configuración de servidores (actualizado)

## 🔍 Estructura de Datos

### VerificationRequest
```typescript
{
  id: string;                    // ID único de la solicitud
  userId: string;                // ID del usuario en Discord
  guildId: string;               // ID del servidor
  inGameName: string;            // Nombre en el juego
  screenshotUrl: string;         // URL de la captura
  status: "pending" | "approved" | "rejected";
  requestedAt: number;           // Timestamp de creación
  reviewedBy?: string;           // ID del moderador que revisó
  reviewedAt?: number;           // Timestamp de revisión
  messageId?: string;            // ID del mensaje en el canal de revisión
}
```

### GuildConfig (campos añadidos)
```typescript
{
  verificationChannelId?: string;       // Canal del panel de verificación
  verificationReviewChannelId?: string; // Canal de revisión
  verifiedRoleId?: string;              // Rol de verificado
}
```

## 🔒 Permisos Necesarios

El bot necesita los siguientes permisos en el servidor:

- **Manage Roles** - Para asignar el rol de verificado
- **Manage Nicknames** - Para cambiar el apodo del usuario
- **Send Messages** - Para enviar mensajes en los canales
- **Embed Links** - Para enviar embeds
- **Read Message History** - Para editar mensajes de revisión

**Importante**: El rol del bot debe estar **por encima** del rol de verificado en la jerarquía de roles.

## 📊 Comandos Disponibles

| Comando | Descripción | Permisos |
|---------|-------------|----------|
| `/setup-verification` | Configura el sistema de verificación | Administrador |
| `/send-verification-panel` | Envía el panel al canal de verificación | Administrador |

## ⚠️ Solución de Problemas

### El bot no puede asignar el rol
- Verifica que el rol del bot esté por encima del rol de verificado
- Revisa que el bot tenga el permiso "Manage Roles"

### El bot no puede cambiar apodos
- Asegúrate de que el bot tenga el permiso "Manage Nicknames"
- El bot no puede cambiar el apodo del propietario del servidor

### Los botones no funcionan
- Verifica que hayas registrado los comandos con `bun run rc`
- Reinicia el bot después de hacer cambios

### Las notificaciones DM no llegan
- El usuario tiene los DMs desactivados
- Esto no afecta el funcionamiento del sistema, solo las notificaciones

## 🚀 Mejoras Futuras

Posibles mejoras que se pueden implementar:

- [ ] Sistema de razones para rechazo
- [ ] Límite de intentos de verificación
- [ ] Panel de estadísticas de verificaciones
- [ ] Verificación de imágenes duplicadas
- [ ] Sistema de appeals para rechazos
- [ ] Logs de auditoría más detallados
- [ ] Configuración de mensaje personalizado por servidor
- [ ] Soporte para múltiples juegos/categorías

## 📝 Notas

- Las solicitudes se almacenan en `data/verifications.json`
- El sistema mantiene un historial de todas las solicitudes (aprobadas, rechazadas y pendientes)
- Los moderadores pueden ver quién aprobó/rechazó cada solicitud
- El usuario recibe notificación por DM (si tiene DMs habilitados)

## 🤝 Soporte

Si encuentras algún problema o tienes sugerencias, revisa los logs en `logs/` para más información sobre errores.