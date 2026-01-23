# 🚀 Guía Rápida - Sistema de Economía y Juegos

## ⚡ Inicio Rápido

### 1. Migración de Base de Datos (YA COMPLETADA ✅)
```bash
bun --bun run prisma migrate dev --name add_economy_and_games_system
bun --bun run prisma generate
```

### 2. Registrar Comandos
```bash
bun run rc
```

### 3. Iniciar el Bot
```bash
bun run dev
```

## 🎮 Comandos Básicos

### Ver tu dinero
```
/balance
```

### Trabajar (ganar dinero seguro)
```
/work
```
- Ganas: $100-$300
- Cooldown: 30 minutos
- Sin riesgo

### Guardar dinero en el banco
```
/deposit 500
```
- El banco protege tu dinero de robos

### Retirar dinero del banco
```
/withdraw 200
```
- Necesario para apostar en la ruleta

## 🎰 Jugar Ruleta

### Apostar por color (x2)
```
/roulette tipo:Color apuesta:red cantidad:100
/roulette tipo:Color apuesta:black cantidad:50
/roulette tipo:Color apuesta:green cantidad:25
```

### Apostar por número (x36)
```
/roulette tipo:Número apuesta:17 cantidad:50
/roulette tipo:Número apuesta:0 cantidad:20
```

### Cómo funciona:
1. Haces tu apuesta
2. Espera 30 segundos (otros pueden unirse)
3. La ruleta gira automáticamente
4. ¡Ganas o pierdes!

## 💰 Formas de Ganar Dinero

### 1. 💼 Work (Seguro)
```
/work
```
- ✅ $100-$300 por trabajo
- ⏰ 30 minutos de espera
- 🛡️ Sin riesgo

### 2. 🎭 Crime (Riesgoso)
```
/crime
```
- ✅ $300-$900 si tienes éxito
- ❌ Pierdes 50% de todo si fallas
- 🚔 Prisión si no puedes pagar
- ⏰ 1 hora de espera
- 📊 40-65% de éxito

### 3. 🦹 Rob (Muy riesgoso)
```
/rob @usuario
```
- ✅ Robas 40-80% de su bolsillo
- ❌ Pagas 20% de tu total si fallas
- 🚔 Prisión si no puedes pagar
- ⏰ 2 horas de espera
- 📊 60% de éxito

## 🏦 Gestión de Dinero

### Bolsillo 👛
- Dinero que llevas contigo
- Puede ser robado
- Necesario para la ruleta

### Banco 🏦
- Dinero guardado
- NO puede ser robado
- Más seguro

### Estrategia recomendada:
```
1. /work              → Gana dinero
2. /deposit 800       → Guarda la mayoría
3. /withdraw 200      → Saca solo lo que necesitas
4. /roulette ...      → Apuesta con precaución
```

## 🚔 Sistema de Prisión

### Vas a prisión si:
- Fallas un crime y no puedes pagar (30 min)
- Fallas un rob y no puedes pagar (45 min)

### En prisión NO puedes:
- ❌ Trabajar
- ❌ Cometer crímenes
- ❌ Robar
- ❌ Jugar ruleta
- ❌ Manejar tu dinero

### Salida:
⏰ Automática cuando termine el tiempo

## 🎯 Tips para Principiantes

1. **Empieza con Work**
   - Usa `/work` cada 30 minutos
   - Es dinero gratis sin riesgo

2. **Protege tu dinero**
   - Usa `/deposit` para guardar en el banco
   - Solo lleva en el bolsillo lo necesario

3. **Apuestas pequeñas**
   - Empieza con apuestas bajas en la ruleta
   - Aprende las probabilidades

4. **Evita Crime/Rob al inicio**
   - Son muy riesgosos sin respaldo
   - Pueden dejarte en prisión

## 🎲 Probabilidades de Ruleta

### Color (x2)
- 🔴 Rojo: 48.6% (18/37)
- ⚫ Negro: 48.6% (18/37)
- 🟢 Verde: 2.7% (1/37)

### Número (x36)
- Cualquier número: 2.7% (1/37)

### Ejemplo de ganancias:
```
Apuesta $100 en rojo  → Gana $200 (48.6% chance)
Apuesta $100 en el 17 → Gana $3600 (2.7% chance)
```

## 📊 Cooldowns

| Comando  | Tiempo   |
|----------|----------|
| `/work`  | 30 min   |
| `/crime` | 1 hora   |
| `/rob`   | 2 horas  |

## ⚠️ Advertencias

1. **No apuestes todo tu dinero**
   - Puedes perderlo todo en un mal giro

2. **El Crime es riesgoso**
   - Puedes perder 50% de TODO tu dinero
   - Incluye banco y bolsillo

3. **Rob puede salir caro**
   - Si fallas, pagas 20% de tu total
   - Solo roba del bolsillo de la víctima

4. **Prisión es molesta**
   - No puedes hacer nada por 30-45 minutos
   - Planifica con cuidado

## 🔥 Estrategia Avanzada

### Para acumular dinero rápido:
```
1. /work (cada 30 min)
2. /deposit [casi todo]
3. /crime (cuando tengas respaldo)
4. Si sale bien: /deposit [ganancias]
5. Repetir
```

### Para la ruleta:
```
1. Acumula $5000 en el banco
2. /withdraw 1000
3. Apuesta en color (más seguro)
4. Si ganas 3 veces seguidas: /deposit
5. Si pierdes todo: vuelve a /work
```

### Para robar:
```
1. Verifica que la víctima tenga dinero
   /balance @victima
2. Solo roba si puedes pagar 20% de tu total
3. Guarda las ganancias inmediatamente
   /deposit [cantidad]
```

## 🆘 Solución de Problemas

### "Fondos insuficientes"
- Usa `/balance` para verificar tu dinero
- Necesitas dinero en el BOLSILLO para apostar
- Usa `/withdraw` si está todo en el banco

### "Estás en prisión"
- Espera a que termine el tiempo
- Se muestra cuándo sales: `<t:timestamp:R>`

### "Necesitas descansar" / Cooldown
- Cada comando tiene un tiempo de espera
- Se muestra el tiempo restante

### "No puedes robarte a ti mismo"
- Selecciona otro usuario con `/rob @otro`

## 📱 Comandos Completos

```
/balance [usuario]           - Ver dinero
/deposit <cantidad>          - Guardar en banco
/withdraw <cantidad>         - Sacar del banco
/work                        - Trabajar
/crime                       - Cometer crimen
/rob <usuario>               - Robar a alguien
/roulette <tipo> <apuesta> <cantidad> - Jugar ruleta
```

## 🎉 ¡Listo para Jugar!

1. Escribe `/balance` para ver tu dinero inicial ($1000)
2. Usa `/work` para ganar tu primer sueldo
3. Prueba la ruleta con una apuesta pequeña
4. ¡Diviértete y apuesta responsablemente! 🎰

---

**¿Necesitas ayuda?** Revisa `ECONOMY_GAMES.md` para documentación completa.