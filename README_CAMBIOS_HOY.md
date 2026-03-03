# Cambios de hoy (03/03/2026)


## 1) Problema inicial

La IA a veces se quedaba mucho tiempo pensando.
En algunos modos no respondía y parecía bloqueada.

## 2) Cambios en los 3 modos principales

### deep_researcher

- Antes podía tardar demasiado.
- Ahora, si no hay contexto, responde rápido diciendo que falta información.
- Si tarda mucho, se corta por tiempo (timeout) y devuelve respuesta normal.

### nexus

- Antes también podía quedarse colgado.
- Ahora usa la misma idea:
  - Si no hay contexto suficiente, lo dice.
  - Si tarda demasiado, se corta y devuelve mensaje controlado.

### web_searcher

- Antes, si fallaba la búsqueda web, podía romper todo el flujo.
- Ahora tiene control de errores.
- Si falla proveedor/red, responde con mensaje seguro y no bloquea el chat.

## 3) Cambio general del servicio IA

Se añadió un control de tiempo por modo de IA.

Esto significa:
- Cada modo tiene un tiempo máximo.
- Si supera ese tiempo, el backend corta la ejecución.
- Devuelve una respuesta de seguridad (no se queda colgado).

## 4) Cambios en contexto (RAG)

- Se mejoró el uso de contexto por usuario y colección.
- Se evita mezclar datos de sesiones diferentes.
- Se ajustó la carga de índices para más estabilidad.

## 5) Cambios en búsqueda web

- Se dejó búsqueda web real con proveedor configurable.
- Se añadieron variables de configuración web que faltaban.
- Se incluyeron controles para fuentes más confiables.

## 6) Cambios en Knowledge Graph

- Se avanzó en esquema de nodos y relaciones.
- Se añadieron endpoints de consulta del grafo.
- Se dejó base para validar relaciones extraídas.
- Se preparó backfill para documentos antiguos.

## 7) OpenAlex

- Se revisó el problema de año en resultados.
- Se mantuvieron los ajustes hechos en el servicio OpenAlex.

## 8) Frontend

- Se ajustó la pantalla de carga/login para que no se vea mal.
- Se mantuvo estilo coherente con el resto de la app.

## 9) Limpieza que pediste

- Se quitó la parte de evaluación automática IA del proyecto.
- Se quitaron los tests añadidos hoy del repo.

## Resultado final

- La IA responde mejor.
- Ya no se queda colgada fácilmente.
- Si falla algo externo, responde de forma controlada.
- Con más contexto cargado, el resultado es mejor.
