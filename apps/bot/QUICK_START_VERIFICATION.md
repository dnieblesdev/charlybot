# 🚀 Guía Rápida - Sistema de Verificación

Esta es una guía rápida para poner en funcionamiento el sistema de verificación en menos de 5 minutos.

## ⚡ Configuración Rápida

### 1️⃣ Preparar Discord

**Crea los siguientes elementos en tu servidor:**

- 🎭 **Rol**: `@Verificado` (o el nombre que prefieras)
- 📝 **Canal**: `#verificación` (visible para @everyone)
- 👮 **Canal**: `#solicitudes-verificacion` (solo para moderadores)

**Configura los permisos:**
- Oculta todos los canales principales de @everyone
- Permite ver esos canales solo al rol `@Verificado`
- Deja `#verificación` visible para @everyone

### 2️⃣ Configurar el Bot

**Registra los comandos nuevos:**
```bash
bun run rc
```

**Inicia el bot:**
```bash
bun run dev
```

### 3️⃣ Configurar el Sistema

En Discord, ejecuta:

```
/setup-verification
  verification-channel: #verificación
  review-channel: #solicitudes-verificacion
  verified-role: @Verificado
```

### 4️⃣ Enviar el Panel

```
/send-verification-panel
```

¡Listo! El sistema ya está funcionando. 🎉

---

## 📱 Cómo Funciona

### Para Usuarios Nuevos:

1. Entran al servidor → Solo ven `#verificación`
2. Hacen clic en **"Verificarme"**
3. Llenan el formulario:
   - **Nombre en el juego**
   - **URL de screenshot** (suben imagen a Discord, clic derecho → Copiar enlace)
4. Esperan aprobación

### Para Moderadores:

1. Ven las solicitudes en `#solicitudes-verificacion`
2. Revisan la información y screenshot
3. Hacen clic en:
   - ✅ **Aprobar** → Usuario recibe rol y apodo
   - ❌ **Rechazar** → Usuario recibe notificación

---

## 🔧 Comandos Disponibles

| Comando | Descripción | Permisos |
|---------|-------------|----------|
| `/setup-verification` | Configura el sistema | Administrador |
| `/send-verification-panel` | Envía el panel al canal | Administrador |
| `/list-pending-verifications` | Lista solicitudes pendientes | Moderador |

---

## ⚠️ Requisitos Importantes

### Permisos del Bot:
- ✅ Manage Roles (Administrar roles)
- ✅ Manage Nicknames (Administrar apodos)
- ✅ Send Messages (Enviar mensajes)
- ✅ Embed Links (Incrustar enlaces)

### Jerarquía de Roles:
```
🤖 Rol del Bot
    ↓
👤 @Verificado
    ↓
📝 @everyone
```

**El rol del bot DEBE estar por encima del rol Verificado**

---

## 🎨 Personalización Rápida

### Cambiar el mensaje del panel:

Edita: `src/app/commands/sendVerificationPanel.ts`

```typescript
const embed = new EmbedBuilder()
  .setTitle("Tu título aquí")
  .setDescription("Tu mensaje aquí...")
  .setColor(0x00ff00); // Color en hex
```

### Cambiar el botón:

```typescript
const button = new ButtonBuilder()
  .setLabel("Tu texto")
  .setEmoji("🎮")
  .setStyle(ButtonStyle.Primary);
```

---

## 🐛 Solución de Problemas

### ❌ "No pude asignar el rol"
**Solución:** Mueve el rol del bot por encima del rol Verificado en Configuración del Servidor → Roles

### ❌ "No pude cambiar el apodo"
**Solución:** Verifica que el bot tenga el permiso "Manage Nicknames"

### ❌ Los botones no responden
**Solución:** Reinicia el bot y vuelve a registrar comandos con `bun run rc`

### ℹ️ El usuario no recibe DM
**Nota:** Esto es normal si tiene los DMs desactivados. El sistema funciona igual.

---

## 📊 Ver Solicitudes Pendientes

Como moderador, puedes ejecutar:

```
/list-pending-verifications
```

Esto mostrará todas las solicitudes que están esperando revisión.

---

## 📁 Archivos Creados

El sistema crea automáticamente:
- `data/verifications.json` - Base de datos de solicitudes
- `data/config.json` - Configuración (se actualiza)

**No es necesario crear estos archivos manualmente.**

---

## 🔄 Flujo Completo

```
Usuario entra al servidor
        ↓
Solo ve canal #verificación
        ↓
Hace clic en "Verificarme"
        ↓
Completa formulario (nombre + screenshot)
        ↓
Solicitud aparece en #solicitudes-verificacion
        ↓
Moderador revisa
        ↓
    Aprueba → Usuario recibe rol + apodo cambiado
    Rechaza → Usuario recibe notificación
```

---

## 💡 Consejos

- **Instruye a los usuarios** a subir primero la imagen a Discord antes de llenar el formulario
- **Usa un canal de bienvenida** adicional para explicar el proceso
- **Revisa el log** en `logs/` si hay errores
- **Reenvía el panel** si lo editas o borras con `/send-verification-panel`

---

## 📚 Documentación Completa

Para más detalles, consulta: `VERIFICATION_SYSTEM.md`

---

## ✨ ¡Eso es Todo!

El sistema está listo para usar. Los usuarios ahora pueden verificarse de forma automática y los moderadores pueden gestionar las solicitudes fácilmente.

Si tienes problemas, revisa los logs en la carpeta `logs/` para más información.