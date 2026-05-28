# PLC Dashboard

Visualización de variables PLC desde SQL Server con FastAPI + Chart.js. Muestra 3 gráficos por variable: últimos 30 días, últimos 7 días y últimas 12 horas, con clasificación Bajo/Medio/Alto según los límites configurados en la tabla `Variables`.

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

### Python 3.11+

## Instalación

```bash
pip install -r backend/requirements.txt
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
| `CORS_ORIGINS` | Orígenes permitidos en formato JSON (ej: `["http://localhost:8080"]`) |
| `CACHE_TTL` | TTL del cache en segundos (default: `300`) |

## Correr el backend

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

API disponible en `http://localhost:8000`. Docs en `http://localhost:8000/docs`.

## Servir el frontend

```bash
cd frontend
python -m http.server 8080
```

## Uso

Abrir en el navegador pasando el código de variable por URL:

```
http://localhost:8080/?codigo=123
```

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

### Health check
```bash
curl http://localhost:8000/health
```

## Notas

- Los valores se agrupan por **día** en 30d y 7d, y por **hora** en 12h.
- La query aplica `DATEADD(MINUTE, 175, _TIMESTAMP)` para corrección de zona horaria. Ajustar según el offset real del servidor.
- `TrustServerCertificate=yes` está activo en la connection string. Revisarlo en entornos productivos con SSL configurado.
- Cache en memoria con TTL configurable (default 5 min). Se invalida al reiniciar el proceso.
