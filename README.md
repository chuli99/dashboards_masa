# PLC Dashboard

Visualización de variables PLC desde SQL Server con FastAPI + Next.js (export estático) + Chart.js. Muestra 3 gráficos por variable: últimos 30 días, últimos 7 días y últimas 12 horas, con clasificación Bajo/Medio/Alto según los límites configurados en la tabla `Variables`.

## Requisitos previos

### ODBC Driver 17 for SQL Server

**Windows:** descargar e instalar desde https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

**Linux (Ubuntu/Debian):**
```bash
curl https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -
curl https://packages.microsoft.com/config/ubuntu/22.04/prod.list | sudo tee /etc/apt/sources.list.d/mssql-release.list
sudo apt-get update
ACCEPT_EULA=Y sudo apt-get install -y msodbcsql17 unixodbc-dev
```

### Python 3.11+, Node 20+ y pnpm

## Instalación

```bash
pip install -r backend/requirements.txt
cd frontend && pnpm install
```

## Configuración

```bash
cp .env.example .env
```

Editar `.env`:

| Variable | Descripción |
|---|---|
| `DB_SERVER` | Hostname o IP del servidor SQL Server |
| `DB_NAME` | Nombre de la base de datos |
| `DB_USER` | Usuario SQL |
| `DB_PASSWORD` | Contraseña |
| `DB_DRIVER` | Driver ODBC (default: `ODBC Driver 17 for SQL Server`) |
| `CACHE_TTL` | TTL del cache en segundos (default: `300`) |

## Producción

```bash
cd frontend && pnpm build      # genera frontend/out
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

FastAPI sirve la API y el frontend desde el mismo origen (sin CORS ni Node en el servidor). Docs en `http://localhost:8000/docs`.

## Desarrollo

```bash
uvicorn backend.main:app --reload --port 8000
cd frontend && pnpm dev        # http://localhost:3000 (o 3001 si Grafana ocupa el 3000), proxy de /api → API_URL (default http://localhost:8000)
```

Variables opcionales del frontend: `API_URL` (proxy en dev) y `NEXT_PUBLIC_IMG_BASE` (base de las imágenes de flowsheets, default `http://10.91.1.229:88/images/`, se fija en el build).

## Rutas

| Ruta | Vista |
|---|---|
| `/` | Índice de flowsheets |
| `/?codigo=123` | Gráficos de una variable |
| `/historico/?codigo=123` | Gráficos desde el último dato |
| `/flowsheet/<slug>/` | Mímico SCADA (slugs = archivos en `frontend/flowsheets/`) |
| `/capacidad/<proceso>/` | Cp/Cpk por proceso (adsorcion, elucion, electrodeposicion); variables fijas en `frontend/lib/procesos.ts` |
| `/editor/` | Editor de posiciones de botones |

## Uso

El dashboard carga automáticamente los 3 gráficos. El nombre de la variable y sus límites (min/max) se obtienen de la tabla `Variables`. El botón **Actualizar** en el header refresca los datos sin cambiar la URL.

### Esquema esperado de la tabla `Variables`

| Columna | Tipo | Descripción |
|---|---|---|
| `CODIGO` | int | Identificador de la variable |
| `DESCRIPCION` | varchar | Nombre descriptivo |
| `VALORMIN` | float | Límite inferior |
| `VALORMAX` | float | Límite superior |

## Endpoints

### Metadata de variable
```bash
curl http://localhost:8000/api/variables/123
```

### Estadísticas por período
```bash
curl "http://localhost:8000/api/variables/123/stats?period=30d&valormin=0&valormax=100"
curl "http://localhost:8000/api/variables/123/stats?period=7d&valormin=0&valormax=100"
curl "http://localhost:8000/api/variables/123/stats?period=12h&valormin=0&valormax=100"
```

Respuesta:
```json
{
  "labels": ["01-05", "02-05", "03-05"],
  "bajo":  [null, 4.2, null],
  "medio": [7.1, null, 8.3],
  "alto":  [null, null, null]
}
```

### Timeseries (rango libre)
```bash
curl "http://localhost:8000/api/variables/123/timeseries?days=30"
curl "http://localhost:8000/api/variables/123/timeseries?start_date=2024-01-01T00:00:00&end_date=2024-01-31T00:00:00&downsample=true"
```

### Último valor de varias variables (una sola query)
```bash
curl "http://localhost:8000/api/variables/last?codigos=13,256,257"
# {"13": 9.52, "256": 41.2}   (las variables sin datos se omiten)
```

### Capacidad de proceso (Cp/Cpk)
```bash
curl "http://localhost:8000/api/variables/123/capacidad?horas=24"    # 24 h, puntos de 5 min
curl "http://localhost:8000/api/variables/123/capacidad?horas=168"   # 7 días, puntos de 30 min
```

LSL/USL = parámetros `lsl`/`usl` (definidos por variable en `frontend/lib/procesos.ts`) o, si faltan, `VALORMIN`/`VALORMAX` de `Variables`. σ = desvío estándar global de los datos crudos de la ventana:
`Cp = (USL − LSL) / 6σ`, `Cpk = min(USL − μ, μ − LSL) / 3σ`.

### Health check
```bash
curl http://localhost:8000/health
```

## Flowsheets SCADA

Cada flowsheet es un JSON en `frontend/flowsheets/<slug>.json` (imagen de fondo + botones con coordenadas en `%`), registrado en `frontend/flowsheets/index.ts`. Todos se renderizan con el mismo componente (`components/Flowsheet.tsx`), que pide los valores con una sola request a `/api/variables/last` cada 60 s. Click en un botón → gráficos de esa variable.

```json
{ "codigo": 13, "unit": "m3", "decimals": 3, "left": 84.71, "top": 74.56, "tag": "FI1087" }
```

### Agregar o mover botones

1. Abrir `/editor/`, elegir el flowsheet y arrastrar los botones (Supr elimina el seleccionado).
2. **Copiar JSON** → pegarlo en `frontend/flowsheets/<slug>.json`.
3. Para un flowsheet nuevo: crear el JSON e importarlo en `flowsheets/index.ts`. La ruta `/flowsheet/<slug>/` se genera sola en el build.

## Notas

- Los valores se agrupan por **día** en 30d y 7d, y por **hora** en 12h.
- Los timestamps se usan directamente sin corrección de zona horaria (la DB almacena en hora local).
- `TrustServerCertificate=yes` está activo en la connection string. Revisarlo en entornos productivos con SSL configurado.
- Cache en memoria con TTL configurable (default 5 min). Se invalida al reiniciar el proceso.
