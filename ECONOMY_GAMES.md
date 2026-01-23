# 🎮 Sistema de Economía y Juegos

Este documento describe el sistema de economía y mini-juegos implementado en CharlyBot.

## 📋 Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Base de Datos](#base-de-datos)
- [Comandos Disponibles](#comandos-disponibles)
- [Sistema de Economía](#sistema-de-economía)
- [Juego de Ruleta](#juego-de-ruleta)
- [Formas de Ganar Dinero](#formas-de-ganar-dinero)
- [Sistema de Prisión](#sistema-de-prisión)
- [Cooldowns](#cooldowns)

## 🎯 Descripción General

El sistema de economía permite a los usuarios:
- Ganar dinero trabajando, cometiendo crímenes o robando
- Apostar dinero en la ruleta
- Gestionar su dinero entre bolsillo y banco
- Competir con otros usuarios

## 💾 Base de Datos

### Modelos Prisma

#### UserEconomy
Almacena la información económica de cada usuario:
- `pocket`: Dinero en el bolsillo (vulnerable a robos)
- `bank`: Dinero en el banco (seguro)
- `inJail`: Si está en prisión
- `jailReleaseAt`: Fecha de liberación
- `lastWork`, `lastCrime`, `lastRob`: Control de cooldowns
- `totalEarned`, `totalLost`: Estadísticas

#### RouletteGame
Representa una partida de ruleta:
- `status`: waiting, spinning, finished
- `winningNumber`: Número ganador (0-36)
- `winningColor`: Color ganador (red, black, green)

#### RouletteBet
Apuestas individuales en la ruleta:
- `betType`: "color" o "number"
- `betValue`: Valor apostado
- `result`: "win" o "lose"
- `winAmount`: Cantidad ganada

## 🎮 Comandos Disponibles

### `/balance [usuario]`
Muestra el balance de dinero de un usuario.

**Información mostrada:**
- 👛 Bolsillo
- 🏦 Banco
- 💵 Total
- 📊 Estadísticas (ganado, perdido, neto)
- 🚔 Estado de prisión (si aplica)

**Ejemplo:**
```
/balance
/balance @Usuario
```

---

### `/deposit <cantidad>`
Deposita dinero del bolsillo al banco.

**Características:**
- El dinero en el banco NO puede ser robado
- Mínimo: $1
- Se puede depositar todo el bolsillo

**Ejemplo:**
```
/deposit 500
```

---

### `/withdraw <cantidad>`
Retira dinero del banco al bolsillo.

**Características:**
- El dinero en el bolsillo puede ser robado
- Mínimo: $1
- Se puede retirar todo el banco

**Ejemplo:**
```
/withdraw 200
```

---

### `/work`
Trabaja para ganar dinero de forma segura.

**Características:**
- ✅ Ganancia: $100 - $300
- ⏰ Cooldown: 30 minutos
- 🚫 No disponible en prisión

**Trabajos disponibles:**
- 💻 Programador
- 👨‍🍳 Chef
- 🚗 Conductor de Uber
- 🎸 Músico Callejero
- ☕ Barista
- 📦 Repartidor
- 🎨 Diseñador Gráfico
- 📷 Fotógrafo
- 🧹 Limpiador de Ventanas
- 🎧 DJ
- 🌱 Jardinero
- 🔧 Mecánico
- 📚 Profesor Particular
- 💪 Entrenador Personal
- 🛍️ Vendedor

**Ejemplo:**
```
/work
```

---

### `/crime`
Comete un crimen para ganar más dinero (con riesgo).

**Características:**
- ✅ Ganancia si tiene éxito: $300 - $900 (x3 de work)
- ❌ Si falla: Pierde 50% de todo su dinero
- 🚔 Si no puede pagar: Va a prisión por 30 minutos
- ⏰ Cooldown: 1 hora
- 📊 Tasa de éxito: 40% - 65% (depende del crimen)

**Crímenes disponibles:**
- 🏪 Robar una tienda (60%)
- 💻 Hackear cajero automático (55%)
- 📦 Vender artículos robados (65%)
- 📄 Falsificar documentos (50%)
- 🚗 Robar un auto (45%)
- 🏦 Asaltar un banco (40%)
- 📦 Contrabandear mercancía (58%)
- 💰 Extorsionar comerciante (52%)
- 💎 Robar joyas (48%)
- 💳 Fraude en línea (62%)

**Ejemplo:**
```
/crime
```

---

### `/rob <usuario>`
Intenta robar el dinero del bolsillo de otro usuario.

**Características:**
- ✅ Ganancia si tiene éxito: 40% - 80% del bolsillo de la víctima
- ❌ Si falla: Paga 20% de tu dinero total a la víctima
- 🚔 Si no puedes pagar: Prisión por 45 minutos
- ⏰ Cooldown: 2 horas
- 📊 Tasa de éxito: 60%
- 🛡️ Solo roba del bolsillo, no del banco

**Restricciones:**
- No puedes robarte a ti mismo
- No puedes robar a bots
- La víctima debe tener dinero en el bolsillo

**Ejemplo:**
```
/rob @Usuario
```

---

### `/roulette <tipo> <apuesta> <cantidad>`
Juega a la ruleta apostando color o número.

**Tipos de apuesta:**
1. **Color (x2):**
   - 🔴 Red (Rojo)
   - ⚫ Black (Negro)
   - 🟢 Green (Verde - solo 0)

2. **Número (x36):**
   - Números del 0 al 36

**Características:**
- ⏰ Tiempo de espera: 30 segundos para más apuestas
- 👥 Múltiples jugadores pueden apostar en la misma partida
- 💰 El dinero se resta del bolsillo al apostar
- 🎉 Las ganancias se depositan en el bolsillo
- 🚫 No disponible en prisión

**Números de la ruleta:**
- 🟢 Verde: 0
- 🔴 Rojos: 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
- ⚫ Negros: 2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35

**Ejemplos:**
```
/roulette tipo:Color apuesta:red cantidad:100
/roulette tipo:Número apuesta:17 cantidad:50
/roulette tipo:Color apuesta:green cantidad:200
```

## 💰 Sistema de Economía

### Bolsillo vs Banco

**👛 Bolsillo (Pocket):**
- Dinero que llevas contigo
- Necesario para apostar en la ruleta
- **VULNERABLE** a robos de otros jugadores
- Recibe las ganancias de work, crime y ruleta

**🏦 Banco (Bank):**
- Dinero guardado de forma segura
- **NO PUEDE** ser robado
- Útil para proteger tus ahorros
- Requiere usar `/withdraw` para usar el dinero

### Dinero Inicial
- Los usuarios nuevos comienzan con $1000 en el bolsillo

### Estadísticas
El sistema rastrea:
- 📈 Total ganado
- 📉 Total perdido
- 💹 Ganancia neta

## 🎰 Juego de Ruleta

### Flujo del Juego

1. **Inicio:** Un jugador usa `/roulette` y se crea una nueva partida
2. **Apuestas:** Durante 30 segundos, otros jugadores pueden unirse
3. **Giro:** La ruleta gira automáticamente después del tiempo
4. **Suspenso:** Se muestra un mensaje de "girando" por 3 segundos
5. **Resultado:** Se revela el número y color ganador
6. **Premios:** Se pagan las ganancias automáticamente

### Multiplicadores

- **Color:** x2 (Apuestas $100 → Gana $200)
- **Número:** x36 (Apuestas $100 → Gana $3600)

### Ejemplo de Partida

```
Jugador 1: Apuesta $100 en Rojo
Jugador 2: Apuesta $50 en el número 17
Jugador 3: Apuesta $200 en Negro

Resultado: 🔴 17 RED

Jugador 1: Gana $200 (color correcto)
Jugador 2: Gana $1800 (número correcto)
Jugador 3: Pierde $200 (color incorrecto)
```

## 🚔 Sistema de Prisión

### ¿Cuándo vas a prisión?

1. **Crime fallido sin dinero:** 30 minutos
2. **Rob fallido sin dinero:** 45 minutos

### Restricciones en Prisión

Mientras estás en prisión NO puedes:
- ❌ Trabajar (`/work`)
- ❌ Cometer crímenes (`/crime`)
- ❌ Robar (`/rob`)
- ❌ Jugar ruleta (`/roulette`)
- ❌ Depositar dinero (`/deposit`)
- ❌ Retirar dinero (`/withdraw`)

### Salir de Prisión

- ⏰ Automático: Cuando termine el tiempo
- 🔓 El sistema te libera automáticamente al usar cualquier comando

## ⏰ Cooldowns

| Comando | Cooldown | Propósito |
|---------|----------|-----------|
| `/work` | 30 minutos | Evitar spam de trabajo |
| `/crime` | 1 hora | Balancear riesgo/recompensa |
| `/rob` | 2 horas | Proteger a los jugadores |

### Verificación de Cooldown

El sistema muestra el tiempo restante en minutos y segundos:
```
⏰ Necesitas descansar. Podrás trabajar de nuevo en 15m 30s
```

## 🎯 Estrategias Recomendadas

### Para Principiantes
1. Usa `/work` regularmente para ingresos estables
2. Guarda dinero en el banco con `/deposit`
3. Empieza con apuestas pequeñas en la ruleta

### Para Jugadores Experimentados
1. Usa `/crime` cuando tengas respaldo en el banco
2. Roba solo si puedes permitirte perder el 20%
3. Juega la ruleta con dinero que puedas perder

### Consejos de Seguridad
- 🏦 Siempre mantén algo de dinero en el banco
- 👛 Solo lleva en el bolsillo lo que necesites
- ⚠️ Ten cuidado al usar `/rob` - puedes perder mucho
- 💡 El crime tiene mejor recompensa pero mayor riesgo

## 🔧 Migración de Base de Datos

Después de agregar los modelos, ejecuta:

```bash
bun prisma migrate dev --name add_economy_system
bun prisma generate
```

## 📝 Notas Técnicas

### Servicios

- **EconomyService:** Gestiona toda la economía de usuarios
- **RouletteService:** Maneja la lógica de la ruleta

### Logs

Todos los comandos y eventos importantes se registran en los logs:
- Apuestas en ruleta
- Resultados de work/crime/rob
- Transferencias de dinero
- Entradas a prisión

### Manejo de Errores

El sistema maneja automáticamente:
- Fondos insuficientes
- Usuarios en prisión
- Cooldowns activos
- Apuestas inválidas
- Transacciones fallidas

## 🚀 Próximas Mejoras (Opcional)

- [ ] Sistema de logros y recompensas
- [ ] Tienda para comprar items especiales
- [ ] Misiones diarias
- [ ] Tabla de clasificación (leaderboard)
- [ ] Bonos por racha de trabajo
- [ ] Sistema de préstamos entre usuarios
- [ ] Eventos especiales de ruleta con multiplicadores
- [ ] Sistema de seguros contra robos