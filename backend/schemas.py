from datetime import datetime
from enum import IntEnum
from typing import Literal

from pydantic import BaseModel

Periodo = Literal["30d", "7d", "12h"]


class Ventana(IntEnum):
    """Ventana de capacidad en horas (IntEnum y no Literal: convierte el "24" de la query string)."""

    DIA = 24
    SEMANA = 168


class Variable(BaseModel):
    codigo: int
    nombre: str | None
    valormin: float
    valormax: float
    unidad: str


class UltimoValor(BaseModel):
    codigo: int
    valor: float


class Stats(BaseModel):
    """Promedios por intervalo, separados según caigan bajo, dentro o sobre [valormin, valormax]."""

    labels: list[str]
    bajo: list[float | None]
    medio: list[float | None]
    alto: list[float | None]


class Rango(BaseModel):
    start: datetime
    end: datetime


class Timeseries(BaseModel):
    data: list[list[int | float | None]]  # [timestamps unix, valores]
    series: list[str]
    codigo: int
    count: int
    range: Rango


class Capacidad(BaseModel):
    lsl: float
    usl: float
    n: int
    media: float | None
    sigma: float | None
    cp: float | None
    cpk: float | None
    tiempos: list[datetime]  # hora local de la DB: ordenable, alinea varias variables en un gráfico
    valores: list[float | None]


class Health(BaseModel):
    status: Literal["ok"]
