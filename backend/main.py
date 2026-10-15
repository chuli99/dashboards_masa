import logging
import time
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from sqlalchemy import bindparam, text

from .config import settings
from .database import engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="PLC Dashboard API")

# Cache en memoria thread-safe
_cache: dict = {}
_cache_lock = threading.Lock()


def _cache_get(key: str):
    with _cache_lock:
        entry = _cache.get(key)
        if entry and time.time() < entry["exp"]:
            return entry["val"]
    return None


def _cache_set(key: str, val, ttl: int):
    with _cache_lock:
        _cache[key] = {"val": val, "exp": time.time() + ttl}


_QUERY_STATS_30D = """
SELECT
  FORMAT(DATEADD(MINUTE, DATEDIFF(MINUTE, 0, PN._TIMESTAMP) / 5 * 5, 0), 'dd-MM HH:mm') AS Etiqueta,
  CASE WHEN AVG(PN._VALOR) < :vmin THEN AVG(PN._VALOR) ELSE NULL END AS Bajo,
  CASE WHEN AVG(PN._VALOR) >= :vmin AND AVG(PN._VALOR) <= :vmax THEN AVG(PN._VALOR) ELSE NULL END AS Medio,
  CASE WHEN AVG(PN._VALOR) > :vmax THEN AVG(PN._VALOR) ELSE NULL END AS Alto
FROM PLCNarrow PN
RIGHT JOIN Variables V ON PN._VARIABLE = V.CODIGO
WHERE PN._TIMESTAMP >= DATEADD(DAY, -30, GETDATE())
  AND PN._VARIABLE = :codigo
GROUP BY DATEADD(MINUTE, DATEDIFF(MINUTE, 0, PN._TIMESTAMP) / 5 * 5, 0)
ORDER BY MIN(PN._TIMESTAMP)
"""

_QUERY_STATS_7D = """
SELECT
  FORMAT(PN._TIMESTAMP, 'dd-MM') AS Etiqueta,
  CASE WHEN AVG(PN._VALOR) < :vmin THEN AVG(PN._VALOR) ELSE NULL END AS Bajo,
  CASE WHEN AVG(PN._VALOR) >= :vmin AND AVG(PN._VALOR) <= :vmax THEN AVG(PN._VALOR) ELSE NULL END AS Medio,
  CASE WHEN AVG(PN._VALOR) > :vmax THEN AVG(PN._VALOR) ELSE NULL END AS Alto
FROM PLCNarrow PN
RIGHT JOIN Variables V ON PN._VARIABLE = V.CODIGO
WHERE PN._TIMESTAMP >= DATEADD(DAY, -7, GETDATE())
  AND PN._VARIABLE = :codigo
GROUP BY FORMAT(PN._TIMESTAMP, 'dd-MM')
ORDER BY MIN(PN._TIMESTAMP)
"""

_QUERY_STATS_12H = """
SELECT
  FORMAT(PN._TIMESTAMP, 'HH') AS Etiqueta,
  CAST(CASE WHEN AVG(PN._VALOR) < :vmin THEN AVG(PN._VALOR) ELSE NULL END AS FLOAT) AS Bajo,
  CAST(CASE WHEN AVG(PN._VALOR) >= :vmin AND AVG(PN._VALOR) <= :vmax THEN AVG(PN._VALOR) ELSE NULL END AS FLOAT) AS Medio,
  CAST(CASE WHEN AVG(PN._VALOR) > :vmax THEN AVG(PN._VALOR) ELSE NULL END AS FLOAT) AS Alto
FROM PLCNarrow PN
RIGHT JOIN Variables V ON PN._VARIABLE = V.CODIGO
WHERE PN._TIMESTAMP >= DATEADD(HOUR, -12, GETDATE())
  AND PN._VARIABLE = :codigo
GROUP BY FORMAT(PN._TIMESTAMP, 'HH')
ORDER BY MIN(PN._TIMESTAMP)
"""

_STATS_QUERIES = {"30d": _QUERY_STATS_30D, "7d": _QUERY_STATS_7D, "12h": _QUERY_STATS_12H}

_QUERY_HIST_30D = """
WITH Rango AS (SELECT MAX(_TIMESTAMP) AS fin FROM PLCNarrow WHERE _VARIABLE = :codigo)
SELECT
  FORMAT(DATEADD(MINUTE, DATEDIFF(MINUTE, 0, PN._TIMESTAMP) / 5 * 5, 0), 'dd-MM HH:mm') AS Etiqueta,
  CASE WHEN AVG(PN._VALOR) < :vmin THEN AVG(PN._VALOR) ELSE NULL END AS Bajo,
  CASE WHEN AVG(PN._VALOR) >= :vmin AND AVG(PN._VALOR) <= :vmax THEN AVG(PN._VALOR) ELSE NULL END AS Medio,
  CASE WHEN AVG(PN._VALOR) > :vmax THEN AVG(PN._VALOR) ELSE NULL END AS Alto
FROM PLCNarrow PN
JOIN Variables V ON PN._VARIABLE = V.CODIGO
JOIN Rango ON PN._TIMESTAMP BETWEEN DATEADD(DAY, -30, Rango.fin) AND Rango.fin
WHERE PN._VARIABLE = :codigo
GROUP BY DATEADD(MINUTE, DATEDIFF(MINUTE, 0, PN._TIMESTAMP) / 5 * 5, 0)
ORDER BY MIN(PN._TIMESTAMP)
"""

_QUERY_HIST_7D = """
WITH Rango AS (SELECT MAX(_TIMESTAMP) AS fin FROM PLCNarrow WHERE _VARIABLE = :codigo)
SELECT
  FORMAT(PN._TIMESTAMP, 'dd-MM') AS Etiqueta,
  CASE WHEN AVG(PN._VALOR) < :vmin THEN AVG(PN._VALOR) ELSE NULL END AS Bajo,
  CASE WHEN AVG(PN._VALOR) >= :vmin AND AVG(PN._VALOR) <= :vmax THEN AVG(PN._VALOR) ELSE NULL END AS Medio,
  CASE WHEN AVG(PN._VALOR) > :vmax THEN AVG(PN._VALOR) ELSE NULL END AS Alto
FROM PLCNarrow PN
JOIN Variables V ON PN._VARIABLE = V.CODIGO
JOIN Rango ON PN._TIMESTAMP BETWEEN DATEADD(DAY, -7, Rango.fin) AND Rango.fin
WHERE PN._VARIABLE = :codigo
GROUP BY FORMAT(PN._TIMESTAMP, 'dd-MM')
ORDER BY MIN(PN._TIMESTAMP)
"""

_QUERY_HIST_12H = """
WITH Rango AS (SELECT MAX(_TIMESTAMP) AS fin FROM PLCNarrow WHERE _VARIABLE = :codigo)
SELECT
  FORMAT(PN._TIMESTAMP, 'HH') AS Etiqueta,
  CAST(CASE WHEN AVG(PN._VALOR) < :vmin THEN AVG(PN._VALOR) ELSE NULL END AS FLOAT) AS Bajo,
  CAST(CASE WHEN AVG(PN._VALOR) >= :vmin AND AVG(PN._VALOR) <= :vmax THEN AVG(PN._VALOR) ELSE NULL END AS FLOAT) AS Medio,
  CAST(CASE WHEN AVG(PN._VALOR) > :vmax THEN AVG(PN._VALOR) ELSE NULL END AS FLOAT) AS Alto
FROM PLCNarrow PN
JOIN Variables V ON PN._VARIABLE = V.CODIGO
JOIN Rango ON PN._TIMESTAMP BETWEEN DATEADD(HOUR, -12, Rango.fin) AND Rango.fin
WHERE PN._VARIABLE = :codigo
GROUP BY FORMAT(PN._TIMESTAMP, 'HH')
ORDER BY MIN(PN._TIMESTAMP)
"""

_STATS_HIST_QUERIES = {"30d": _QUERY_HIST_30D, "7d": _QUERY_HIST_7D, "12h": _QUERY_HIST_12H}

_QUERY = """
SELECT
    PN._TIMESTAMP AS Fecha,
    PN._VALOR AS Valor
FROM PLCNarrow PN
RIGHT JOIN Variables V ON PN._VARIABLE = V.CODIGO
WHERE PN._VARIABLE = :codigo
  AND PN._TIMESTAMP >= :start_date
  AND PN._TIMESTAMP <= :end_date
ORDER BY Fecha ASC
"""

_QUERY_DS_HORA = """
SELECT
    DATEADD(HOUR, DATEDIFF(HOUR, 0, PN._TIMESTAMP), 0) AS Fecha,
    AVG(PN._VALOR) AS Valor
FROM PLCNarrow PN
RIGHT JOIN Variables V ON PN._VARIABLE = V.CODIGO
WHERE PN._VARIABLE = :codigo
  AND PN._TIMESTAMP >= :start_date
  AND PN._TIMESTAMP <= :end_date
GROUP BY DATEADD(HOUR, DATEDIFF(HOUR, 0, PN._TIMESTAMP), 0)
ORDER BY Fecha ASC
"""

_QUERY_DS_MINUTO = """
SELECT
    DATEADD(MINUTE, DATEDIFF(MINUTE, 0, PN._TIMESTAMP), 0) AS Fecha,
    AVG(PN._VALOR) AS Valor
FROM PLCNarrow PN
RIGHT JOIN Variables V ON PN._VARIABLE = V.CODIGO
WHERE PN._VARIABLE = :codigo
  AND PN._TIMESTAMP >= :start_date
  AND PN._TIMESTAMP <= :end_date
GROUP BY DATEADD(MINUTE, DATEDIFF(MINUTE, 0, PN._TIMESTAMP), 0)
ORDER BY Fecha ASC
"""


_QUERY_LAST_MANY = text("""
SELECT _VARIABLE, _VALOR FROM (
  SELECT _VARIABLE, _VALOR, ROW_NUMBER() OVER (PARTITION BY _VARIABLE ORDER BY _TIMESTAMP DESC) AS rn
  FROM PLCNarrow WHERE _VARIABLE IN :codigos
) t WHERE rn = 1
""").bindparams(bindparam("codigos", expanding=True))


@app.get("/api/variables/last")
def get_last_values(codigos: str = Query(..., pattern=r"^\d+(,\d+)*$")):
    """Último valor de varias variables en una sola query: {codigo: valor}."""
    lista = sorted({int(c) for c in codigos.split(",")})
    cache_key = f"lastmany:{lista}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        with engine.connect() as conn:
            rows = conn.execute(_QUERY_LAST_MANY, {"codigos": lista}).fetchall()
    except Exception as e:
        logger.error(f"Error last values codigos={codigos}: {e}")
        raise HTTPException(500, f"Error al consultar la base de datos: {e}")

    response = {codigo: float(valor) for codigo, valor in rows if valor is not None}
    _cache_set(cache_key, response, 30)
    return response


@app.get("/api/variables/{codigo}")
def get_variable(codigo: int):
    cache_key = f"var:{codigo}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT CODIGO, DESCRIPCION, VALORMIN, VALORMAX, Unidad FROM Variables WHERE CODIGO = :codigo"),
                {"codigo": codigo},
            )
            row = result.fetchone()
    except Exception as e:
        logger.error(f"Error variable {codigo}: {e}")
        raise HTTPException(500, f"Error al consultar la base de datos: {e}")

    if row is None:
        raise HTTPException(404, f"Variable {codigo} no encontrada")

    response = {
        "codigo": row[0],
        "nombre": row[1],
        "valormin": float(row[2]) if row[2] is not None else 0,
        "valormax": float(row[3]) if row[3] is not None else 100,
        "unidad": row[4] or "",
    }
    _cache_set(cache_key, response, settings.cache_ttl)
    return response


@app.get("/api/variables/{codigo}/last")
def get_last_value(codigo: int):
    cache_key = f"last:{codigo}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT TOP 1 _VALOR FROM PLCNarrow WHERE _VARIABLE = :codigo ORDER BY _TIMESTAMP DESC"),
                {"codigo": codigo},
            )
            row = result.fetchone()
    except Exception as e:
        logger.error(f"Error last value codigo={codigo}: {e}")
        raise HTTPException(500, f"Error al consultar la base de datos: {e}")

    if row is None or row[0] is None:
        raise HTTPException(404, f"Sin datos para variable {codigo}")

    response = {"codigo": codigo, "valor": float(row[0])}
    _cache_set(cache_key, response, 30)
    return response


@app.get("/health")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Health check fallido: {e}")
        raise HTTPException(500, f"DB no disponible: {e}")


@app.get("/api/variables/{codigo}/timeseries")
def get_timeseries(
    codigo: int,
    days: int = Query(30, ge=1),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    downsample: bool = False,
):
    end = end_date or datetime.utcnow()
    start = start_date or (end - timedelta(days=days))

    cache_key = f"{codigo}:{start.isoformat()}:{end.isoformat()}:{downsample}"
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info(f"Cache hit: {cache_key}")
        return cached

    delta_dias = (end - start).days
    if downsample:
        query = _QUERY_DS_MINUTO if delta_dias <= 7 else _QUERY_DS_HORA
    else:
        query = _QUERY

    try:
        with engine.connect() as conn:
            result = conn.execute(
                text(query),
                {"codigo": codigo, "start_date": start, "end_date": end},
            )
            rows = result.fetchall()
    except Exception as e:
        logger.error(f"Error en query codigo={codigo}: {e}")
        raise HTTPException(500, f"Error al consultar la base de datos: {e}")

    timestamps = []
    valores = []
    for fecha, valor in rows:
        if fecha is not None:
            timestamps.append(int(fecha.timestamp()))
            valores.append(float(valor) if valor is not None else None)

    response = {
        "data": [timestamps, valores],
        "series": ["Fecha", "Valor"],
        "codigo": codigo,
        "count": len(timestamps),
        "range": {"start": start.isoformat(), "end": end.isoformat()},
    }

    _cache_set(cache_key, response, settings.cache_ttl)
    return response


@app.get("/api/variables/{codigo}/stats")
def get_stats(
    codigo: int,
    period: str = Query("7d", pattern="^(30d|7d|12h)$"),
    valormin: float = 0,
    valormax: float = 100,
    from_last_data: bool = False,
):
    cache_key = f"stats:{codigo}:{period}:{valormin}:{valormax}:{from_last_data}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    queries = _STATS_HIST_QUERIES if from_last_data else _STATS_QUERIES
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text(queries[period]),
                {"codigo": codigo, "vmin": valormin, "vmax": valormax},
            )
            rows = result.fetchall()
    except Exception as e:
        logger.error(f"Error stats {period} codigo={codigo}: {e}")
        raise HTTPException(500, f"Error al consultar la base de datos: {e}")

    labels, bajo, medio, alto = [], [], [], []
    for etiqueta, b, m, a in rows:
        labels.append(etiqueta)
        bajo.append(float(b) if b is not None else None)
        medio.append(float(m) if m is not None else None)
        alto.append(float(a) if a is not None else None)

    response = {"labels": labels, "bajo": bajo, "medio": medio, "alto": alto}
    _cache_set(cache_key, response, settings.cache_ttl)
    return response


# Capacidad de proceso: ventana en horas → minutos por punto del gráfico (24h: 5 min, 7d: 30 min)
_CAPACIDAD_BUCKET = {24: 5, 168: 30}

_QUERY_CAPACIDAD_STATS = text("""
SELECT COUNT(_VALOR), AVG(CAST(_VALOR AS FLOAT)), STDEV(_VALOR)
FROM PLCNarrow
WHERE _VARIABLE = :codigo AND _TIMESTAMP >= DATEADD(HOUR, -:horas, GETDATE())
""")

_QUERY_CAPACIDAD_SERIE = """
SELECT t, AVG(CAST(v AS FLOAT)) FROM (
  SELECT DATEADD(MINUTE, DATEDIFF(MINUTE, 0, _TIMESTAMP) / {m} * {m}, 0) AS t, _VALOR AS v
  FROM PLCNarrow
  WHERE _VARIABLE = :codigo AND _TIMESTAMP >= DATEADD(HOUR, -:horas, GETDATE())
) x
GROUP BY t
ORDER BY t
"""


@app.get("/api/variables/{codigo}/capacidad")
def get_capacidad(
    codigo: int,
    horas: int = Query(24),
    lsl: Optional[float] = None,
    usl: Optional[float] = None,
):
    """Cp/Cpk de la ventana con σ global de los datos crudos. LSL/USL por parámetro o, si faltan, VALORMIN/VALORMAX."""
    if horas not in _CAPACIDAD_BUCKET:
        raise HTTPException(422, f"horas debe ser uno de {list(_CAPACIDAD_BUCKET)}")
    cache_key = f"cap:{codigo}:{horas}:{lsl}:{usl}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    if lsl is None or usl is None:
        variable = get_variable(codigo)
        lsl = variable["valormin"] if lsl is None else lsl
        usl = variable["valormax"] if usl is None else usl
    params = {"codigo": codigo, "horas": horas}
    try:
        with engine.connect() as conn:
            n, media, sigma = conn.execute(_QUERY_CAPACIDAD_STATS, params).fetchone()
            serie = conn.execute(text(_QUERY_CAPACIDAD_SERIE.format(m=_CAPACIDAD_BUCKET[horas])), params).fetchall()
    except Exception as e:
        logger.error(f"Error capacidad codigo={codigo} horas={horas}: {e}")
        raise HTTPException(500, f"Error al consultar la base de datos: {e}")

    ok = bool(sigma) and usl > lsl
    response = {
        "lsl": lsl,
        "usl": usl,
        "n": n,
        "media": media,
        "sigma": sigma,
        "cp": (usl - lsl) / (6 * sigma) if ok else None,
        "cpk": min(usl - media, media - lsl) / (3 * sigma) if ok else None,
        # ISO (hora local de la DB): ordenable, permite alinear varias variables en un mismo gráfico
        "tiempos": [t.isoformat() for t, _ in serie],
        "valores": [v for _, v in serie],
    }
    _cache_set(cache_key, response, 60 if horas == 24 else settings.cache_ttl)
    return response


# Frontend Next.js exportado (npm run build en frontend/). Montado al final para no tapar /api.
_FRONTEND = Path(__file__).resolve().parent.parent / "frontend" / "out"
if _FRONTEND.is_dir():
    app.mount("/", StaticFiles(directory=_FRONTEND, html=True), name="frontend")
