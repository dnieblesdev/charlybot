# Migración del Leaderboard a Net Profit

## ¿Qué hace este script?

Este script actualiza el leaderboard para que use **ganancia neta** (netProfit) en lugar de dinero total (pocket + bank).

## ¿Por qué es necesario?

El sistema anterior tenía un problema de diseño:
- El **banco es global** (compartido entre todos los servidores)
- El **leaderboard es por servidor**
- Contar el banco en el leaderboard significa contar dinero ganado en otros servidores

### Problema de ejemplo:
```
Usuario gana $1000 en Servidor A → deposita al banco
Usuario gana $500 en Servidor B → deposita al banco
Banco total: $1500 (GLOBAL)

Leaderboard Servidor A: pocket_A + $1500 ❌ (cuenta dinero del Servidor B)
Leaderboard Servidor B: pocket_B + $1500 ❌ (cuenta dinero del Servidor A)
```

### Solución:
Usar **ganancia neta** del servidor: `totalEarned - totalLost`

Esto refleja el verdadero rendimiento del usuario EN ESE SERVIDOR específicamente.

## ¿Qué cambia?

### Antes:
```typescript
totalMoney = pocket + bank (mezcla datos globales y por servidor)
```

### Después:
```typescript
totalMoney = totalEarned - totalLost (100% datos del servidor)
```

**Nota:** El campo se sigue llamando `totalMoney` en la base de datos por compatibilidad, pero ahora almacena `netProfit`.

## ¿Cómo ejecutar la migración?

### Opción 1: Con Bun (recomendado)
```bash
bun run scripts/migrate-leaderboard-netprofit.ts
```

### Opción 2: Con ts-node
```bash
npx ts-node scripts/migrate-leaderboard-netprofit.ts
```

### Opción 3: Compilar y ejecutar
```bash
npx tsc scripts/migrate-leaderboard-netprofit.ts
node scripts/migrate-leaderboard-netprofit.js
```

## ¿Qué hace el script?

1. 📊 Lee todos los registros del leaderboard
2. 🔍 Para cada usuario, busca sus estadísticas en `UserEconomy`
3. 🧮 Calcula: `netProfit = totalEarned - totalLost`
4. 💾 Actualiza el valor en el leaderboard
5. 📈 Muestra un resumen de los cambios

## Ejemplo de salida:

```
🚀 Iniciando migración del leaderboard a netProfit...

📊 Encontrados 15 registros en el leaderboard

✅ JohnDoe: $1250.00 → $890.50 (Δ: -359.50)
✅ JaneSmith: $2340.00 → $2100.00 (Δ: -240.00)
✅ BobPlayer: $450.00 → $670.20 (Δ: 220.20)
...

============================================================
📈 Resumen de la migración:
============================================================
✅ Actualizados: 15
⚠️  Omitidos: 0
❌ Errores: 0
📊 Total: 15
============================================================

✨ Migración completada exitosamente!
💡 El leaderboard ahora muestra la ganancia neta (totalEarned - totalLost) por servidor.

👋 Proceso finalizado.
```

## ¿Es seguro ejecutarlo múltiples veces?

✅ **Sí, es idempotente.** Puedes ejecutarlo cuantas veces quieras. Simplemente recalcula los valores basándose en las estadísticas actuales.

## ¿Qué pasa con los usuarios nuevos?

Los usuarios nuevos se actualizarán automáticamente con el nuevo sistema. El `LeaderboardService` ya está actualizado para usar `netProfit`.

## Verificación post-migración

Después de ejecutar la migración, puedes verificar que todo funciona correctamente:

1. Ejecuta el comando `/leaderboard` en Discord
2. Verifica que el footer diga: "Ranking basado en ganancia neta (total ganado - total perdido)"
3. Compara los valores con el comando `/balance` de algunos usuarios

## Archivos modificados

- ✅ `src/app/services/economy/LeaderboardService.ts` - Usa netProfit en lugar de totalMoney
- ✅ `src/app/commands/leaderboard.ts` - Actualizado para reflejar netProfit
- ✅ `prisma/schema.prisma` - Comentario actualizado en el modelo Leaderboard
- ✅ `scripts/migrate-leaderboard-netprofit.ts` - Script de migración de datos

## Soporte

Si encuentras algún problema durante la migración:
1. Revisa los logs del script
2. Verifica que la base de datos esté accesible
3. Asegúrate de que el modelo `UserEconomy` tiene los campos `totalEarned` y `totalLost`

## Nota importante

⚠️ **Haz un backup de tu base de datos antes de ejecutar la migración.**

```bash
# Para SQLite (dev.db):
cp dev.db dev.db.backup-$(date +%Y%m%d_%H%M%S)

# Para PostgreSQL:
pg_dump -U username -d database_name > backup.sql
```
