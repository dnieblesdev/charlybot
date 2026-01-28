# 🏆 Script de Inicialización del Leaderboard

Este script migra todos los usuarios existentes en el sistema de economía al leaderboard por servidor.

## 📋 ¿Qué hace este script?

1. Se conecta a Discord usando el bot
2. Busca todos los servidores que tienen usuarios con economía
3. Para cada servidor:
   - Obtiene todos los usuarios con datos de economía
   - Calcula su dinero total (pocket + bank)
   - Obtiene la fecha de ingreso al servidor desde Discord API
   - Crea una entrada en la tabla `Leaderboard`
4. Muestra un resumen detallado de la migración

## 🚀 Cómo ejecutar

### Requisitos previos:
- ✅ La migración de Prisma ya debe estar aplicada (`bunx --bun prisma migrate dev`)
- ✅ El bot debe estar en los servidores que quieres migrar
- ✅ Las variables de entorno deben estar configuradas (`.env` con `DISCORD_TOKEN`)

### Comando:

```bash
cd C:\Users\dniebles\workplace\personal\descktop-server\charlybot
bun run scripts/init-leaderboard.ts
```

## 📊 Salida del script

El script mostrará:

```
🚀 Iniciando migración del leaderboard...

🔐 Conectando con Discord...
✅ Conectado exitosamente

📊 Servidores encontrados con usuarios de economía: 2

============================================================
📍 Procesando servidor: 123456789012345678
============================================================
🏢 Servidor: Mi Servidor Genial
👥 Usuarios encontrados: 5

  ✅ Usuario1: $1500.00 (Ingresó: 15/01/2024)
  ✅ Usuario2: $2300.50 (Ingresó: 20/02/2024)
  ⏭️  Usuario3 ya existe en leaderboard, saltando...
  ✅ Usuario4: $500.00 (Ingresó: 10/03/2024)
  ⚠️  Usuario5: $100.00 (No se pudo obtener fecha de ingreso, usando fecha actual)

✅ Servidor completado: 5/5 usuarios migrados

============================================================
📊 RESUMEN DE MIGRACIÓN
============================================================

🏢 Por Servidor:

  Mi Servidor Genial (123456789012345678)
    ✅ Éxito: 5/5 (100.0%)

📈 Total General:
  👥 Usuarios procesados: 5
  ✅ Migrados exitosamente: 5
  ❌ Fallos: 0
  📊 Tasa de éxito: 100.0%

============================================================
✅ Migración completada!
============================================================
```

## ⚠️ Casos especiales

### Usuario ya existe en el leaderboard
- El script detecta si un usuario ya está migrado y lo salta automáticamente
- Es seguro ejecutar el script múltiples veces

### No se puede obtener fecha de ingreso
- Si el usuario ya no está en el servidor o hubo un error
- Se usa la fecha actual como fallback
- El usuario se migra de todos modos

### Bot no está en el servidor
- Si el bot ya no está en un servidor que tiene datos de economía
- Se marca como "No se pudo acceder" pero no falla la migración completa

## 🔧 Problemas comunes

### Error: "DISCORD_TOKEN no encontrado"
**Solución:** Asegúrate de tener el archivo `.env` con la variable `DISCORD_TOKEN`

### Error: "Property 'leaderboard' does not exist"
**Solución:** Ejecuta primero `bunx --bun prisma generate` después de la migración

### El script se queda colgado
**Solución:** 
- Verifica tu conexión a internet
- Asegúrate de que el token de Discord sea válido
- Revisa que el bot tenga permisos de "Guild Members Intent" habilitado

## 📝 Notas importantes

- ⚠️ Este script debe ejecutarse **SOLO UNA VEZ** después de aplicar la migración del leaderboard
- ✅ Es seguro ejecutarlo múltiples veces (no duplica datos)
- 🔒 El script requiere intents de `Guilds` y `GuildMembers` en Discord
- 📊 El leaderboard es **por servidor** (cada servidor tiene su propio ranking)
- 💾 Los datos se guardan en la tabla `Leaderboard` de SQLite

## 🎯 Después de ejecutar

Una vez completado el script exitosamente:

1. ✅ Los usuarios pueden usar `/leaderboard` en Discord
2. ✅ El ranking se actualiza automáticamente cuando alguien gana/pierde dinero
3. ✅ Ya no necesitas ejecutar este script de nuevo

## 🆘 Soporte

Si encuentras errores durante la migración:
1. Revisa los logs del script (se muestran en consola)
2. Verifica los logs en `./logs` (si están configurados)
3. Asegúrate de que la base de datos no esté corrupta
4. Verifica que el backup de la base de datos se haya creado correctamente