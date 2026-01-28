# 📋 Eventos de Miembros

Este documento describe los eventos de entrada y salida de miembros del servidor, sus características y configuración.

## 🎉 Evento de Bienvenida (GuildMemberAdd)

### Descripción
Detecta cuando un nuevo miembro se une al servidor y envía un mensaje de bienvenida personalizado.

### Características

#### ✨ Mensaje Personalizado
Si has configurado un mensaje personalizado con `/set-welcome-message`, se enviará ese mensaje. Puedes usar los siguientes placeholders:
- `{user}` - Mención del usuario (@Usuario)
- `{username}` - Nombre del usuario sin mención
- `{server}` - Nombre del servidor

**Ejemplo:**
```
¡Bienvenido {user} a {server}! Esperamos que disfrutes tu estancia.
```

#### 🎨 Embed Automático
Si NO has configurado un mensaje personalizado, el bot enviará automáticamente un embed bonito con:
- ✅ Avatar del usuario
- ✅ Nombre y tag del usuario
- ✅ ID del usuario
- ✅ Número de miembro (#123)
- ✅ Fecha de creación de la cuenta (formato relativo)
- ✅ Diseño en color verde

### Configuración

1. **Configurar canal de bienvenida:**
   ```
   /set-welcome-channel canal:#bienvenida
   ```

2. **Configurar mensaje personalizado (opcional):**
   ```
   /set-welcome-message mensaje:¡Bienvenido {user} a {server}!
   ```

### Ejemplo Visual del Embed

```
╔══════════════════════════════════════╗
║  🎊 ¡Nuevo miembro!                  ║
╠══════════════════════════════════════╣
║  [Avatar]                            ║
║                                      ║
║  🎉 ¡Bienvenido/a Usuario#1234       ║
║      a Mi Servidor!                  ║
║                                      ║
║  👤 Usuario: @Usuario#1234           ║
║  🆔 ID: 123456789                    ║
║  📊 Miembro número: #42              ║
║  📅 Cuenta creada: Hace 2 meses      ║
║                                      ║
║  ¡Esperamos que disfrutes tu         ║
║  estancia!                           ║
╚══════════════════════════════════════╝
```

---

## 👋 Evento de Salida (GuildMemberRemove)

### Descripción
Detecta cuando un miembro abandona el servidor (ya sea que salga voluntariamente o sea expulsado) y registra su salida.

### Características

#### 🎨 Embed Informativo
El bot enviará automáticamente un embed bonito con:
- ✅ Avatar del usuario
- ✅ Nombre y tag del usuario
- ✅ ID del usuario
- ✅ Cantidad actual de miembros en el servidor
- ✅ Tiempo que estuvo en el servidor (días u horas)
- ✅ Diseño en color rojo suave

### Configuración

**Configurar canal de logs de salida:**
```
/set-leave-log-channel canal:#logs-salidas
```

### Ejemplo Visual del Embed

```
╔══════════════════════════════════════╗
║  🚪 Miembro abandonó el servidor     ║
╠══════════════════════════════════════╣
║  [Avatar]                            ║
║                                      ║
║  👋 Usuario#1234 ha salido del       ║
║     servidor                         ║
║                                      ║
║  👤 Usuario: @Usuario#1234           ║
║  🆔 ID: 123456789                    ║
║  📊 Total de miembros: 41            ║
║  ⏱️ Tiempo en el servidor:           ║
║     Estuvo 15 días en el servidor    ║
║                                      ║
║  Mi Servidor                         ║
╚══════════════════════════════════════╝
```

---

## 🔧 Requisitos Técnicos

### Intents Necesarios
Para que estos eventos funcionen, el bot requiere los siguientes intents configurados en el **Discord Developer Portal**:

1. **Server Members Intent** (Intent Privilegiado)
   - Ve a: Applications → Tu Bot → Bot → Privileged Gateway Intents
   - Activa: **SERVER MEMBERS INTENT**

### Partials Configurados
El bot está configurado con los siguientes partials para manejar eventos de miembros que no están en caché:
- `Partials.GuildMember`
- `Partials.User`

Esto asegura que los eventos se disparen incluso para miembros que no están en el caché del bot.

---

## 📊 Logs Internos

### Logs de Bienvenida
```
✅ Mensaje de bienvenida enviado correctamente
   - guildId: 123456789
   - channelId: 987654321
   - userId: 111222333
   - userTag: Usuario#1234
   - hasCustomMessage: true/false
```

### Logs de Salida
```
✅ Mensaje de salida enviado correctamente
   - guildId: 123456789
   - channelId: 987654321
   - userId: 111222333
   - userTag: Usuario#1234
```

### Logs de Debug (cuando no está configurado)
```
⚠️ No hay canal de bienvenida configurado
⚠️ No hay canal de logs de salida configurado
⚠️ Canal no encontrado en caché
⚠️ El canal no es un canal de texto
```

---

## ❓ Preguntas Frecuentes

### ¿Por qué no veo los eventos de salida?
- Verifica que el intent **SERVER MEMBERS INTENT** esté habilitado en el Discord Developer Portal
- Asegúrate de haber configurado el canal con `/set-leave-log-channel`
- Verifica que el bot tenga permisos para enviar mensajes en el canal configurado

### ¿Puedo personalizar el embed de salida?
Actualmente el embed de salida no es personalizable para mantener un formato consistente. Sin embargo, puedes solicitar esta característica.

### ¿El evento de bienvenida siempre usa embed?
No, si configuras un mensaje personalizado con `/set-welcome-message`, se usará ese mensaje en lugar del embed. El embed solo se usa si no hay mensaje personalizado.

### ¿Qué pasa si borro el canal configurado?
El bot detectará que el canal no existe y no enviará el mensaje. Verás un warning en los logs. Deberás configurar un nuevo canal.

### ¿El bot distingue entre kicks y salidas voluntarias?
No, Discord no proporciona esta información en el evento `GuildMemberRemove`. El evento se dispara tanto para salidas voluntarias como para kicks/bans.

---

## 🎨 Personalización Futura

### Características Planificadas
- [ ] Embeds personalizables para salidas
- [ ] Roles asignados automáticamente al unirse
- [ ] Mensajes DM de bienvenida
- [ ] Estadísticas de entrada/salida
- [ ] Detección de bots vs usuarios reales
- [ ] Logs diferenciados para kicks/bans

---

## 📝 Notas Técnicas

### Manejo de Objetos Parciales
El evento de salida maneja correctamente objetos parciales (`PartialGuildMember`), lo que significa que funcionará incluso si el miembro no está en el caché del bot.

### Performance
Los eventos están optimizados para no bloquear otros procesos del bot. Si hay un error al enviar un mensaje, se registra pero no afecta el funcionamiento general del bot.

### Seguridad
- Los embeds sanitizan automáticamente los nombres de usuario
- Los IDs se muestran en formato de código para facilitar copiar/pegar
- No se expone información sensible del usuario

---

**Última actualización:** Enero 2024
**Versión:** 1.0.0