# Sistema de Auto-Roles

Sistema automatizado para asignar y remover roles mediante reacciones o botones en mensajes específicos.

## 📋 Características

- **Reacciones y Botones**: Soporta tanto reacciones emoji como botones interactivos
- **Modos de asignación**:
  - **Múltiple**: Los usuarios pueden obtener varios roles del mismo mensaje
  - **Único**: Solo pueden tener un rol a la vez (al seleccionar uno nuevo, se remueve el anterior)
- **Hasta 10 roles** por mensaje configurado
- **Interfaz interactiva** para configuración fácil
- **Gestión completa**: Listar, editar y eliminar configuraciones

## 🚀 Comandos Disponibles

### `/autorole-setup [message_id] [canal]`
Configura roles automáticos en un mensaje nuevo o existente.

**Parámetros:**
- `message_id` (opcional): ID de un mensaje existente. Si no se proporciona, el bot creará un mensaje nuevo.
- `canal` (opcional): Canal donde el bot enviará el mensaje nuevo de autorole. Si no se proporciona, usa el canal donde ejecutaste el comando.

**Permisos requeridos:** Administrador

**Flujo:**
1. Si no proporcionas `message_id`:
   - Se abrirá un modal para configurar el título, descripción y modo del mensaje
   - El bot creará un mensaje embed en el `canal` elegido (o en el canal donde ejecutaste el comando)

2. Si proporcionas `message_id`:
   - El bot configurará roles en ese mensaje existente

3. Interfaz interactiva:
   - **➕ Agregar Rol**: Abre un modal para agregar un nuevo rol
   - **✏️ Editar**: Permite editar roles existentes
   - **🗑️ Eliminar**: Elimina un rol de la configuración
   - **🔄 Cambiar Modo**: Alterna entre modo múltiple y único
   - **⚙️ Personalizar Embed**: Personaliza color, footer, thumbnail, imagen y autor del embed
   - **✅ Finalizar**: Guarda la configuración y activa el sistema
   - **❌ Cancelar**: Cancela sin guardar

**Ejemplo:**
```
/autorole-setup
/autorole-setup message_id:1234567890123456789
```

---

### `/autorole-list`
Lista todas las configuraciones de auto-roles activas en el servidor.

**Permisos requeridos:** Administrador

**Muestra:**
- Título del mensaje configurado
- Canal donde está el mensaje
- Modo (múltiple o único)
- Cantidad de roles configurados
- Lista de roles con sus emojis/botones
- Link directo al mensaje

**Ejemplo:**
```
/autorole-list
```

---

### `/autorole-edit <message_id>`
Proporciona información sobre cómo editar una configuración existente.

**Parámetros:**
- `message_id` (requerido): ID del mensaje configurado

**Permisos requeridos:** Administrador

**Nota:** Para editar completamente una configuración, se recomienda eliminarla y recrearla.

**Ejemplo:**
```
/autorole-edit message_id:1234567890123456789
```

---

### `/autorole-remove <message_id>`
Elimina una configuración de auto-roles.

**Parámetros:**
- `message_id` (requerido): ID del mensaje configurado

**Permisos requeridos:** Administrador

**Importante:** 
- El mensaje en Discord NO será eliminado
- Solo se elimina la configuración de auto-roles
- Los usuarios conservan los roles que ya tenían

**Ejemplo:**
```
/autorole-remove message_id:1234567890123456789
```

---

## 📝 Cómo Configurar un Auto-Role

### Opción 1: Crear un mensaje nuevo

1. Ejecuta `/autorole-setup` (sin parámetros)
2. Completa el modal:
   - **Título del Embed**: Título que verán los usuarios
   - **Descripción del Embed**: Texto explicativo
   - **Modo**: Escribe `multiple` o `unique`
3. En la interfaz interactiva, presiona **➕ Agregar Rol**
4. Completa el modal de rol:
   - **Tipo**: `reaction` (para reacción) o `button` (para botón)
   - **Emoji o Label**: Si es reacción, pon el emoji (😀). Si es botón, pon el texto
   - **ID del Rol**: El ID numérico del rol en Discord
   - **Color del botón** (opcional, solo para botones): `PRIMARY`, `SECONDARY`, `SUCCESS`, `DANGER`
5. Repite el paso 3-4 para agregar más roles (máximo 10)
6. **(Opcional)** Presiona **⚙️ Personalizar Embed** para:
   - **Color del Embed**: Código hexadecimal (ej: #5865F2)
   - **Texto del Footer**: Texto al pie del embed
   - **URL de la Thumbnail**: Imagen pequeña en la esquina
   - **URL de la Imagen**: Imagen grande en el embed
   - **Texto del Autor**: Nombre del autor del embed
7. Presiona **✅ Finalizar** para guardar

### Opción 2: Usar un mensaje existente

1. Copia el ID del mensaje que quieres usar
2. Ejecuta `/autorole-setup message_id:TU_ID_AQUI`
3. Sigue los pasos 3-6 de la Opción 1

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Roles de colores (múltiples)
```
Título: "Escoge tus colores favoritos"
Descripción: "Puedes tener varios colores a la vez"
Modo: multiple

Roles:
🔴 Rojo (reaction) → Rol "Color Rojo"
🔵 Azul (reaction) → Rol "Color Azul"
🟢 Verde (reaction) → Rol "Color Verde"
```

### Ejemplo 2: Roles de región (único)
```
Título: "Selecciona tu región"
Descripción: "Solo puedes estar en una región"
Modo: unique

Roles:
🌎 América (button) → Rol "América"
🌍 Europa (button) → Rol "Europa"
🌏 Asia (button) → Rol "Asia"
```

### Ejemplo 3: Notificaciones con botones (múltiples)
```
Título: "Notificaciones"
Descripción: "Activa las notificaciones que te interesan"
Modo: multiple

Roles:
🔘 Anuncios (button, PRIMARY) → Rol "Notif-Anuncios"
🔘 Eventos (button, SUCCESS) → Rol "Notif-Eventos"
🔘 Sorteos (button, DANGER) → Rol "Notif-Sorteos"
```

---

## 🔧 Troubleshooting

### "No tengo permisos para gestionar roles"
**Solución:** Verifica que el bot tenga el permiso `MANAGE_ROLES` en el servidor.

### "No puedo asignar el rol X"
**Problema:** El rol está por encima del rol más alto del bot.
**Solución:** Mueve el rol del bot por encima de los roles que quieres asignar.

### "El emoji no funciona"
**Para emojis personalizados:** Debes usar el formato completo del emoji personalizado.
**Para obtenerlo:** Escribe `\:nombre_emoji:` en Discord y copia el resultado.

### "Los botones no aparecen"
**Problema:** Configuraste como "reaction" en lugar de "button".
**Solución:** Elimina la configuración y créala de nuevo, asegurándote de poner `button` en el tipo.

### "No puedo encontrar el ID de un mensaje"
1. Activa el Modo Desarrollador en Discord (Ajustes → Avanzado → Modo Desarrollador)
2. Click derecho en el mensaje → Copiar ID

### "No puedo encontrar el ID de un rol"
1. Activa el Modo Desarrollador en Discord
2. Ve a Configuración del Servidor → Roles
3. Click derecho en el rol → Copiar ID

---

## ⚙️ Detalles Técnicos

### Base de Datos
El sistema utiliza dos tablas:
- `AutoRole`: Información principal de la configuración (incluye personalización del embed)
- `RoleMapping`: Mapeo de emojis/botones a roles

### Personalización del Embed
Campos opcionales disponibles:
- **Color**: Código hexadecimal (ej: #FF5733)
- **Footer**: Texto al pie del mensaje
- **Thumbnail**: URL de imagen pequeña (esquina superior derecha)
- **Imagen**: URL de imagen grande (parte inferior)
- **Autor**: Nombre que aparece como autor del embed

### Validaciones
- Verifica jerarquía de roles (el bot debe poder asignar el rol)
- Valida que los roles existan en el servidor
- Límite de 10 roles por mensaje
- Evita emojis duplicados en el mismo mensaje

### Logs
El sistema registra en consola:
- Creación/edición/eliminación de configuraciones
- Asignación/remoción de roles
- Errores en el proceso

**Nota:** Los logs NO se envían a canales de Discord, solo aparecen en la consola del bot.

---

## 📌 Notas Importantes

1. **Permisos del bot**: El bot necesita `MANAGE_ROLES` y debe estar por encima de los roles que asignará
2. **Partials habilitados**: El sistema maneja mensajes y reacciones parciales automáticamente
3. **Modo único**: En este modo, al seleccionar un nuevo rol se remueven automáticamente los otros roles del mismo mensaje
4. **Persistencia**: Las configuraciones se guardan en la base de datos y sobreviven reinicios del bot
5. **Reacciones**: El bot agregará automáticamente las reacciones configuradas al mensaje
6. **Botones**: Soporta hasta 25 botones por mensaje (5 filas de 5 botones)

---

## 🆘 Soporte

Si encuentras problemas o tienes preguntas sobre el sistema de auto-roles, contacta con los administradores del bot.

---

**Versión:** 1.0.0  
**Última actualización:** Febrero 2025
