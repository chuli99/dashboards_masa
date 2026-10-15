from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import Connection

from .. import repositorio
from ..cache import cache
from ..config import settings
from ..database import ConnDep
from ..schemas import Capacidad, Periodo, Rango, Stats, Timeseries, UltimoValor, Variable, Ventana

router = APIRouter(prefix="/api/variables", tags=["variables"])

CodigoPath = Annotated[int, Path(description="Código de la variable (tabla Variables)")]

TTL_ULTIMO = 30  # s: los valores en vivo se refrescan seguido


def obtener_variable(conn: Connection, codigo: int) -> Variable:
    def buscar() -> Variable:
        variable = repositorio.buscar_variable(conn, codigo)
        if variable is None:
            raise HTTPException(404, f"Variable {codigo} no encontrada")
        return variable

    return cache.get_or_set(f"var:{codigo}", settings.cache_ttl, buscar)


# Declarada antes de /{codigo} para que "last" no se interprete como código
@router.get("/last")
def get_ultimos_valores(
    conn: ConnDep,
    codigos: Annotated[str, Query(pattern=r"^\d+(,\d+)*$", description="Códigos separados por coma")],
) -> dict[int, float]:
    """Último valor de varias variables en una sola query. Las variables sin datos se omiten."""
    lista = sorted({int(c) for c in codigos.split(",")})
    return cache.get_or_set(f"lastmany:{lista}", TTL_ULTIMO, lambda: repositorio.ultimos_valores(conn, lista))


@router.get("/{codigo}")
def get_variable(conn: ConnDep, codigo: CodigoPath) -> Variable:
    return obtener_variable(conn, codigo)


@router.get("/{codigo}/last")
def get_ultimo_valor(conn: ConnDep, codigo: CodigoPath) -> UltimoValor:
    def buscar() -> UltimoValor:
        valor = repositorio.ultimo_valor(conn, codigo)
        if valor is None:
            raise HTTPException(404, f"Sin datos para variable {codigo}")
        return UltimoValor(codigo=codigo, valor=valor)

    return cache.get_or_set(f"last:{codigo}", TTL_ULTIMO, buscar)


@router.get("/{codigo}/stats")
def get_stats(
    conn: ConnDep,
    codigo: CodigoPath,
    period: Periodo = "7d",
    valormin: float = 0,
    valormax: float = 100,
    from_last_data: Annotated[bool, Query(description="El período termina en el último dato y no en ahora")] = False,
) -> Stats:
    return cache.get_or_set(
        f"stats:{codigo}:{period}:{valormin}:{valormax}:{from_last_data}",
        settings.cache_ttl,
        lambda: repositorio.stats(conn, codigo, period, valormin, valormax, from_last_data),
    )


@router.get("/{codigo}/timeseries")
def get_timeseries(
    conn: ConnDep,
    codigo: CodigoPath,
    days: Annotated[int, Query(ge=1)] = 30,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    downsample: bool = False,
) -> Timeseries:
    end = end_date or datetime.now(UTC).replace(tzinfo=None)
    start = start_date or (end - timedelta(days=days))

    def calcular() -> Timeseries:
        tiempos, valores = repositorio.timeseries(conn, codigo, start, end, downsample)
        return Timeseries(
            data=[tiempos, valores],
            series=["Fecha", "Valor"],
            codigo=codigo,
            count=len(tiempos),
            range=Rango(start=start, end=end),
        )

    return cache.get_or_set(f"{codigo}:{start.isoformat()}:{end.isoformat()}:{downsample}", settings.cache_ttl, calcular)


@router.get("/{codigo}/capacidad")
def get_capacidad(
    conn: ConnDep,
    codigo: CodigoPath,
    horas: Annotated[Ventana, Query(description="Ventana: 24 h o 168 h (7 días)")] = Ventana.DIA,
    lsl: Annotated[float | None, Query(description="Límite inferior; si falta, VALORMIN")] = None,
    usl: Annotated[float | None, Query(description="Límite superior; si falta, VALORMAX")] = None,
) -> Capacidad:
    """Cp/Cpk de la ventana con σ global de los datos crudos."""

    def calcular() -> Capacidad:
        variable = obtener_variable(conn, codigo) if lsl is None or usl is None else None
        return repositorio.capacidad(
            conn,
            codigo,
            horas,
            variable.valormin if lsl is None else lsl,
            variable.valormax if usl is None else usl,
        )

    ttl = 60 if horas == Ventana.DIA else settings.cache_ttl
    return cache.get_or_set(f"cap:{codigo}:{horas}:{lsl}:{usl}", ttl, calcular)
