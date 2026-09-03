---
name: realtime-game-engine
description: Arquitectura de motor de juego Ludo/Parcheesi multijugador en tiempo real, topología de tablero (4/6 jugadores), sincronización de turnos, IA de bots y anti-cheat.
---

# Real-Time Game Engine (Sugar Ludo)

Esta guía define la arquitectura del motor de juego para Ludo/Parcheesi multijugador (2 a 6 jugadores), sincronización autoritativa, topología matemática de tableros y comportamiento de inteligencia artificial.

---

## 1. Topología del Tablero y Sistema de Coordenadas

Todas las fichas se almacenan como un índice lineal `step` entero de `0` a `MAX_STEPS` para simplificar la lógica de movimiento:
- `step = 0`: En la base / patio (Yard).
- `step = 1 .. PERIMETER_LENGTH`: Recorrido perimetral compartido.
- `step = PERIMETER_LENGTH + 1 .. PERIMETER_LENGTH + HOME_LENGTH`: Pasillo final seguro del color.
- `step = PERIMETER_LENGTH + HOME_LENGTH + 1`: Meta final (Goal).

### 1.1 Tablero de 4 Jugadores (Cuadrado Clásico)
- **Perímetro ($N$):** 52 casillas.
- **Pasillo final ($H$):** 5 casillas + 1 meta.
- **Offsets de inicio:** Azul: 1, Verde: 14, Rojo: 27, Amarillo: 40.
- **Casillas Seguras (Estrellas):** `[1, 8, 14, 21, 27, 34, 40, 47]`.

### 1.2 Tablero de 6 Jugadores (Hexagonal)
- **Perímetro ($N$):** 72 casillas (12 por brazo).
- **Pasillo final ($H$):** 5 casillas + 1 meta.
- **Offsets de inicio (horario):** Azul: 1, Púrpura: 13, Verde: 25, Naranja: 37, Rojo: 49, Amarillo: 61.

### 1.3 Fórmula Universal de Conversión a Casilla Global
Para un jugador con color $c$ y avance de ficha `step`:
$$\text{IndicePerimetro}(c, step) = (\text{Offset}[c] + step - 1) \pmod N \quad (\text{para } 1 \le step \le N - 1)$$
$$\text{IndicePasillo}(c, step) = step - N \quad (\text{para } N \le step \le N + H - 1)$$

---

## 2. Reglas Clave de Movimiento y Captura

1. **Salida de la Base:** Requiere sacar un 5 o un 6 (según la modalidad) en el dado.
2. **Casillas Seguras:** Las fichas en casillas con Estrella no pueden ser capturadas por rivales.
3. **Barreras (Bloqueos):** Dos fichas del mismo color en la misma casilla forman una barrera que ninguna ficha rival puede atravesar ni aterrizar encima.
4. **Premio por Captura:** Enviar una ficha enemiga a su base otorga +20 casillas de avance adicional a cualquier ficha propia.
5. **Premio por Meta:** Introducir una ficha a la meta otorga +10 casillas de avance adicional.
6. **Tiro Exacto a Meta:** Para coronar en la meta, se requiere el valor exacto restante en el dado.

---

## 3. Máquina de Estados Finita (FSM) del Motor

```
[INICIO_TURNO] -> [ESPERANDO_TIRO_DADO] -> [EVALUANDO_JUGADAS_LEGALES]
      |                                              |
      v                                              v
[TIEMPO_AGOTADO]                             ¿Hay jugadas posibles?
      |                                      /                  \
      v                                   [SÍ]                  [NO]
[AUTO_PASE_O_BOT]                           |                     |
                                 [ESPERANDO_MOVIMIENTO]      [FIN_TURNO]
                                            |
                                            v
                                   [RESOLVIENDO_MOVIMIENTO]
                                   (Captura / Meta / Extra)
                                            |
                                            v
                                 ¿Hay tiro extra o fin?
```

---

## 4. Gestión de Temporizadores y Desconexiones

1. **Temporizador Autoritativo del Servidor:**
   - Turno estándar: 15 segundos + 2 segundos de buffer de red (grace period).
   - Se calculan timestamps UNIX absolutos del servidor (`turnExpiresAt`), no temporizadores locales del cliente.
2. **Sistema de Strikes y Toma de Control por Bot:**
   - Cada jugador dispone de hasta **3 strikes** (turnos vencidos por inactividad).
   - Al tercer strike consecutivo o desconexión prolongada (>30s), el servidor activa `isBotControlled: true` para que la partida continúe sin retrasar a los demás.
   - Ventana de reconexión de 90s antes de declarar abandono total (forfeit).

---

## 5. Inteligencia Artificial para Bots (Árbol Heurístico de Utilidad)

Para cada movimiento legal candidato $m$, el bot evalúa una función de utilidad ponderada:
$$U(m) = w_{meta} \cdot \Delta Meta + w_{cap} \cdot \Delta Captura + w_{escape} \cdot \Delta Escape + w_{salida} \cdot \Delta SalirBase + w_{segura} \cdot \Delta CasillaSegura$$

**Matriz de Pesos Heurísticos:**
```typescript
export const BOT_EVALUATION_WEIGHTS = {
  GOAL_ENTRY: 1000,          // Coronar ficha en la meta
  CAPTURE_OPPONENT: 500,     // Capturar ficha rival
  EXIT_BASE: 350,            // Liberar ficha de la base
  ESCAPE_DANGER: 300,        // Mover ficha amenazada a menos de 6 pasos de un rival
  ENTER_SAFE_ZONE: 150,      // Llegar a una estrella
  ADVANCE_BASE: 10,          // Avance estándar
  CREATE_VULNERABILITY: -250 // Quedar expuesto en casilla vulnerable
};
```

---

## 6. Economía de Apuestas, Rake y Reparto de Premios

$$\text{Pozo Bruto} = N \times \text{Tarifa de Entrada}$$
$$\text{Rake de la Casa} = \lfloor \text{Pozo Bruto} \times 0.10 \rfloor \quad (10\%)$$
$$\text{Pozo Neto a Distribuir} = \text{Pozo Bruto} - \text{Rake}$$

- **Partidas de 2 Jugadores:** 1º Lugar recibe el 100% del pozo neto ($90\%$ del total).
- **Partidas de 4 Jugadores:** 1º Lugar: $70\%$, 2º Lugar: $30\%$ del pozo neto.
- **Partidas de 6 Jugadores:** 1º Lugar: $60\%$, 2º Lugar: $25\%$, 3º Lugar: $15\%$ del pozo neto.
