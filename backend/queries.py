"""SQL de la app (SQL Server). PLCNarrow guarda una fila por lectura: _VARIABLE, _TIMESTAMP, _VALOR."""

from sqlalchemy import bindparam, text

from .schemas import Ventana

VARIABLE = text("SELECT CODIGO, DESCRIPCION, VALORMIN, VALORMAX, Unidad FROM Variables WHERE CODIGO = :codigo")

ULTIMO_VALOR = text("SELECT TOP 1 _VALOR FROM PLCNarrow WHERE _VARIABLE = :codigo ORDER BY _TIMESTAMP DESC")

ULTIMOS_VALORES = text("""
SELECT _VARIABLE, _VALOR FROM (
  SELECT _VARIABLE, _VALOR, ROW_NUMBER() OVER (PARTITION BY _VARIABLE ORDER BY _TIMESTAMP DESC) AS rn
  FROM PLCNarrow WHERE _VARIABLE IN :codigos
) t WHERE rn = 1
""").bindparams(bindparam("codigos", expanding=True))

PING = text("SELECT 1")

# --- Stats Bajo/Medio/Alto por período ---------------------------------------------------------
# Etiqueta y agrupación por período; el rango termina en GETDATE() o, con from_last_data, en el último dato.
_STATS_PERIODOS = {
    "30d": ("FORMAT(DATEADD(MINUTE, DATEDIFF(MINUTE, 0, PN._TIMESTAMP) / 5 * 5, 0), 'dd-MM HH:mm')",
            "DATEADD(MINUTE, DATEDIFF(MINUTE, 0, PN._TIMESTAMP) / 5 * 5, 0)", "DAY, -30"),
    "7d": ("FORMAT(PN._TIMESTAMP, 'dd-MM')", "FORMAT(PN._TIMESTAMP, 'dd-MM')", "DAY, -7"),
    "12h": ("FORMAT(PN._TIMESTAMP, 'HH')", "FORMAT(PN._TIMESTAMP, 'HH')", "HOUR, -12"),
}

_STATS = """
{cte}
SELECT
  {etiqueta} AS Etiqueta,
  CAST(CASE WHEN AVG(PN._VALOR) < :vmin THEN AVG(PN._VALOR) END AS FLOAT) AS Bajo,
  CAST(CASE WHEN AVG(PN._VALOR) >= :vmin AND AVG(PN._VALOR) <= :vmax THEN AVG(PN._VALOR) END AS FLOAT) AS Medio,
  CAST(CASE WHEN AVG(PN._VALOR) > :vmax THEN AVG(PN._VALOR) END AS FLOAT) AS Alto
FROM PLCNarrow PN
JOIN Variables V ON PN._VARIABLE = V.CODIGO
{rango}
WHERE PN._VARIABLE = :codigo {filtro}
GROUP BY {grupo}
ORDER BY MIN(PN._TIMESTAMP)
"""


def _stats(etiqueta: str, grupo: str, desde: str, historico: bool):
    if historico:
        return text(_STATS.format(
            cte="WITH Rango AS (SELECT MAX(_TIMESTAMP) AS fin FROM PLCNarrow WHERE _VARIABLE = :codigo)",
            etiqueta=etiqueta, grupo=grupo, filtro="",
            rango=f"JOIN Rango ON PN._TIMESTAMP BETWEEN DATEADD({desde}, Rango.fin) AND Rango.fin",
        ))
    return text(_STATS.format(
        cte="", etiqueta=etiqueta, grupo=grupo, rango="",
        filtro=f"AND PN._TIMESTAMP >= DATEADD({desde}, GETDATE())",
    ))


STATS = {(p, h): _stats(*args, h) for p, args in _STATS_PERIODOS.items() for h in (False, True)}

# --- Timeseries (rango libre) ------------------------------------------------------------------
_TIMESERIES = """
SELECT {fecha} AS Fecha, {valor} AS Valor
FROM PLCNarrow PN
JOIN Variables V ON PN._VARIABLE = V.CODIGO
WHERE PN._VARIABLE = :codigo AND PN._TIMESTAMP >= :start_date AND PN._TIMESTAMP <= :end_date
{grupo}
ORDER BY Fecha ASC
"""


def _timeseries(unidad: str | None):
    if unidad is None:
        return text(_TIMESERIES.format(fecha="PN._TIMESTAMP", valor="PN._VALOR", grupo=""))
    fecha = f"DATEADD({unidad}, DATEDIFF({unidad}, 0, PN._TIMESTAMP), 0)"
    return text(_TIMESERIES.format(fecha=fecha, valor="AVG(PN._VALOR)", grupo=f"GROUP BY {fecha}"))


TIMESERIES = _timeseries(None)
TIMESERIES_MINUTO = _timeseries("MINUTE")
TIMESERIES_HORA = _timeseries("HOUR")

# --- Capacidad de proceso ----------------------------------------------------------------------
# Ventana en horas → minutos por punto del gráfico (24 h: 5 min, 7 d: 30 min)
CAPACIDAD_BUCKET = {Ventana.DIA: 5, Ventana.SEMANA: 30}

CAPACIDAD_STATS = text("""
SELECT COUNT(_VALOR), AVG(CAST(_VALOR AS FLOAT)), STDEV(_VALOR)
FROM PLCNarrow
WHERE _VARIABLE = :codigo AND _TIMESTAMP >= DATEADD(HOUR, -:horas, GETDATE())
""")

_CAPACIDAD_SERIE = """
SELECT t, AVG(CAST(v AS FLOAT)) FROM (
  SELECT DATEADD(MINUTE, DATEDIFF(MINUTE, 0, _TIMESTAMP) / {m} * {m}, 0) AS t, _VALOR AS v
  FROM PLCNarrow
  WHERE _VARIABLE = :codigo AND _TIMESTAMP >= DATEADD(HOUR, -:horas, GETDATE())
) x
GROUP BY t
ORDER BY t
"""

CAPACIDAD_SERIE = {horas: text(_CAPACIDAD_SERIE.format(m=m)) for horas, m in CAPACIDAD_BUCKET.items()}
