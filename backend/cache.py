import threading
import time
from collections.abc import Callable


class TTLCache:
    """Cache en memoria thread-safe con vencimiento por clave. Se pierde al reiniciar el proceso."""

    def __init__(self) -> None:
        self._data: dict[str, tuple[object, float]] = {}
        self._lock = threading.Lock()

    def get_or_set[T](self, key: str, ttl: int, factory: Callable[[], T]) -> T:
        """Devuelve el valor vigente o lo calcula con `factory`. Si `factory` lanza, no se guarda nada."""
        with self._lock:
            entry = self._data.get(key)
            if entry and time.time() < entry[1]:
                return entry[0]  # type: ignore[return-value]
        value = factory()
        with self._lock:
            self._data[key] = (value, time.time() + ttl)
        return value


cache = TTLCache()
