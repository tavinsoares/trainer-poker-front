"""A matriz 13x13 de cada aba: mãos, cores, legenda e EV."""

from __future__ import annotations

import re

from .decimals import parse_decimal
from .errors import ConversionError

# Geometria de toda aba: matriz 13x13 a partir de G5. Cada mão ocupa 8 colunas,
# com o rótulo na primeira e o EV (texto) na oitava.
RANKS = "AKQJT98765432"
GRID_FIRST_ROW = 5
GRID_FIRST_COL = 7  # coluna G
CELL_WIDTH = 8
EV_OFFSET = 7
GRID_SIZE = len(RANKS)
GRID_LAST_COL = GRID_FIRST_COL + CELL_WIDTH * GRID_SIZE - 1

# Legenda: "RÓTULO\nPP.P%" numa célula colorida à direita da matriz.
LEGEND_TEXT = re.compile(r"^(.+?)\s*\n\s*(\d+(?:[.,]\d+)?)\s*%$")

# Rótulo da legenda -> ação canônica. Só entram rótulos já vistos e conferidos nas
# abas tratadas; um rótulo novo faz a conversão falhar em vez de adivinhar.
LABEL_ACTIONS = {
    "RFI": "raise",
    "3BET": "raise",
    "4BET": "raise",
    "JAM": "jam",
    "CALL": "call",
    "FOLD": "fold",
}

# Cores com significado fixo na planilha inteira, para o que a legenda da aba não traz:
# os dois tons de cinza são "fora do range" (nenhuma legenda os cita) e o vermelho-escuro
# é o jam (a legenda o cita em algumas abas, mas não em todas: no MPv3B CO duas mãos
# têm essa cor sem entrada na legenda). A legenda da aba, quando cita a cor, vence.
OUT_OF_RANGE_LABEL = "FORA DO RANGE"
WORKBOOK_COLORS = {
    "FF666666": {"label": OUT_OF_RANGE_LABEL, "action": "out_of_range"},
    "FF666566": {"label": OUT_OF_RANGE_LABEL, "action": "out_of_range"},
    "FFB15B4A": {"label": "JAM", "action": "jam"},
}


def fill_key(cell) -> str | None:
    """Identifica a cor de fundo de uma célula (RGB ou cor de tema), ou None se não há."""
    fill = cell.fill
    if fill is None or fill.fill_type != "solid":
        return None
    color = fill.fgColor
    if color.type == "rgb":
        return str(color.rgb)
    if color.type == "theme":
        return f"theme{color.theme}/{round(color.tint, 4)}"
    return f"{color.type}:{color.value}"


def hand_name(row: int, col: int) -> str:
    """Nome canônico da mão na posição (row, col) da matriz: suited acima da diagonal."""
    high, low = RANKS[row], RANKS[col]
    if row == col:
        return high + low
    return f"{high}{low}s" if row < col else f"{low}{high}o"


def combos_of(name: str) -> int:
    if len(name) == 2:
        return 6
    return 4 if name.endswith("s") else 12


def read_label(value) -> str | None:
    """O rótulo é texto, mas os pares vêm como fórmula (="99") para o Excel não os ler como número."""
    if value is None:
        return None
    text = str(value).strip()
    wrapped = re.fullmatch(r'="(\w+)"', text)
    return wrapped.group(1) if wrapped else text


def read_legend(sheet) -> dict[str, dict]:
    """Lê a legenda da aba: cor de fundo -> rótulo, ação canônica e percentual."""
    legend: dict[str, dict] = {}
    for row in sheet.iter_rows():
        for cell in row:
            if cell.column <= GRID_LAST_COL or not isinstance(cell.value, str):
                continue
            match = LEGEND_TEXT.match(cell.value.strip())
            if not match:
                continue
            key = fill_key(cell)
            if key is None:
                raise ConversionError(f"aba '{sheet.title}': a legenda em {cell.coordinate} não tem cor de fundo")
            label = match.group(1).strip().upper()
            if label not in LABEL_ACTIONS:
                raise ConversionError(
                    f"aba '{sheet.title}': rótulo de legenda desconhecido '{label}' em {cell.coordinate}"
                )
            if key in legend:
                raise ConversionError(
                    f"aba '{sheet.title}': duas entradas de legenda com a mesma cor "
                    f"('{legend[key]['label']}' e '{label}')"
                )
            legend[key] = {
                "label": label,
                "action": LABEL_ACTIONS[label],
                "percent": float(parse_decimal(match.group(2))),
            }
    if not legend:
        raise ConversionError(f"aba '{sheet.title}': legenda não encontrada")
    return legend


def read_ev(sheet, cell) -> float | int | None:
    """EV em bb, guardado como texto (ou número) 7 colunas à frente da mão. Vazio vira None."""
    ev_cell = sheet.cell(cell.row, cell.column + EV_OFFSET)
    raw = ev_cell.value
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return None
    try:
        return parse_decimal(str(raw))
    except ValueError:
        raise ConversionError(
            f"aba '{sheet.title}': EV não numérico {raw!r} na célula {ev_cell.coordinate}"
        ) from None


def check_grid_bounds(sheet) -> None:
    """Falha se houver conteúdo logo abaixo da 13ª linha da matriz (matriz maior que 13x13)."""
    for row in sheet.iter_rows(min_row=GRID_FIRST_ROW + GRID_SIZE, min_col=GRID_FIRST_COL, max_col=GRID_LAST_COL):
        for cell in row:
            if cell.value is not None and str(cell.value).strip():
                raise ConversionError(
                    f"aba '{sheet.title}': a matriz deveria ter 13x13, mas há conteúdo em {cell.coordinate}"
                )


def read_hands(sheet, legend: dict[str, dict]) -> tuple[list[dict], list[dict]]:
    """Lê as 169 mãos da matriz, na ordem da matriz (linha por linha).

    Devolve as mãos e os EVs que a planilha traz em células cinza (fora do range), que são
    descartados do JSON: essas mãos nunca são sorteadas. Eles vão para o relatório, e não somem.
    """
    check_grid_bounds(sheet)
    hands = []
    discarded_ev = []
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            cell = sheet.cell(GRID_FIRST_ROW + row, GRID_FIRST_COL + CELL_WIDTH * col)
            expected = hand_name(row, col)
            found = read_label(cell.value)
            if found != expected:
                raise ConversionError(
                    f"aba '{sheet.title}': a célula {cell.coordinate} deveria ser {expected}, mas tem {found!r}"
                )
            key = fill_key(cell)
            # A legenda da aba vence; só o que ela não cita cai nas cores fixas da planilha.
            entry = legend.get(key) or WORKBOOK_COLORS.get(key)
            if entry is None:
                raise ConversionError(
                    f"aba '{sheet.title}': a cor da célula {cell.coordinate} ({expected}) não consta da "
                    "legenda nem das cores fixas da planilha"
                )
            ev = read_ev(sheet, cell)
            if entry["action"] == "out_of_range":
                if ev is not None:
                    discarded_ev.append({"sheet": sheet.title, "hand": expected, "ev": ev, "color": key})
                ev = None
            hands.append(
                {
                    "hand": expected,
                    "action": entry["action"],
                    "label": entry["label"],
                    "combos": combos_of(expected),
                    "ev": ev,
                }
            )
    return hands, discarded_ev
