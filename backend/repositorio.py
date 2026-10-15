"""Acceso a datos: ejecuta las queries y arma los modelos. Sin HTTP ni cache."""

from datetime import datetime

from sqlalchemy import Connection

from . import queries
from .schemas import Capacidad, Periodo, Stats, Ventana, Variable


def buscar_variable(conn: Connection, codigo: int) -> Variable | None:
    row = conn.execute(queries.VARIABLE, {"codigo": codigo}).fetchone()
    if row is None:
        return None
    cod, nombre, vmin, vmax, unidad = row
    return Variable(
        codigo=cod,
        nombre=nombre,
        valormin=vmin if vmin is not None else 0,
        valormax=vmax if vmax is not None else 100,
        unidad=unidad or "",
    )


def ultimo_valor(conn: Connection, codigo: int) -> float | None:
    row = conn.execute(queries.ULTIMO_VALOR, {"codigo": codigo}).fetchone()
    return None if row is None or row[0] is None else float(row[0])


def ultimos_valores(conn: Connection, codigos: list[int]) -> dict[int, float]:
    rows = conn.execute(queries.ULTIMOS_VALORES, {"codigos": codigos}).fetchall()
    return {codigo: float(valor) for codigo, valor in rows if valor is not None}


def stats(conn: Connection, codigo: int, periodo: Periodo, vmin: float, vmax: float, historico: bool) -> Stats:
    rows = conn.execute(queries.STATS[periodo, historico], {"codigo": codigo, "vmin": vmin, "vmax": vmax}).fetchall()
    labels, bajo, medio, alto = (list(col) for col in zip(*rows)) if rows else ([], [], [], [])
    return Stats(labels=labels, bajo=bajo, medio=medio, alto=alto)


def timeseries(
    conn: Connection, codigo: int, start: datetime, end: datetime, downsample: bool
) -> tuple[list[int], list[float | None]]:
    if not downsample:
        query = queries.TIMESERIES
    else:
        query = queries.TIMESERIES_MINUTO if (end - start).days <= 7 else queries.TIMESERIES_HORA
    rows = conn.execute(query, {"codigo": codigo, "start_date": start, "end_date": end}).fetchall()
    puntos = [(int(fecha.timestamp()), None if v is None else float(v)) for fecha, v in rows if fecha is not None]
    return [t for t, _ in puntos], [v for _, v in puntos]


def capacidad(conn: Connection, codigo: int, horas: Ventana, lsl: float, usl: float) -> Capacidad:
    """Cp/Cpk con σ global (STDEV muestral) de los datos crudos de la ventana."""
    params = {"codigo": codigo, "horas": horas}
    n, media, sigma = conn.execute(queries.CAPACIDAD_STATS, params).fetchone()
    serie = conn.execute(queries.CAPACIDAD_SERIE[horas], params).fetchall()
    ok = bool(sigma) and usl > lsl
    return Capacidad(
        lsl=lsl,
        usl=usl,
        n=n,
        media=media,
        sigma=sigma,
        cp=(usl - lsl) / (6 * sigma) if ok else None,
        cpk=min(usl - media, media - lsl) / (3 * sigma) if ok else None,
        tiempos=[t for t, _ in serie],
        valores=[v for _, v in serie],
    )


def ping(conn: Connection) -> None:
    conn.execute(queries.PING)
