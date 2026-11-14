import math


def parse_decimal(text: str) -> float | int:
    """Número com vírgula ou ponto decimal. Inteiros voltam como int (2, e não 2.0).

    Levanta ValueError se o texto não for um número finito.
    """
    value = float(text.strip().replace(",", "."))
    if not math.isfinite(value):
        raise ValueError(text)
    return int(value) if value.is_integer() else value
