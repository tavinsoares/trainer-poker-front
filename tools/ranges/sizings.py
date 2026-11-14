"""Tamanhos de aposta de cada spot, lidos das formas da barra lateral de cada aba.

Tipos de tamanho: `open` (open do próprio Hero), `threeBet` (3bet do Hero), `fourBet` (4bet do
Hero), `vs4bet` (4bet que o Hero enfrenta), `vs3bet` e `vsOpen` (3bets e opens que o Hero enfrenta,
por posição de quem os fez).
"""

from __future__ import annotations

import re
from typing import NamedTuple

from .decimals import parse_decimal
from .drawings import DrawingReader
from .errors import ConversionError
from .positions import POSITION_ORDER, SEAT_OR_BB, normalize_position

_SIZE = r"(\d+(?:[.,]\d+)?)\s*bb"
SIZING_OPEN = re.compile(rf"^RFI\s+{_SIZE}$", re.IGNORECASE)
SIZING_THREE_BET = re.compile(rf"^{SEAT_OR_BB}\s+3B\s+{_SIZE}$", re.IGNORECASE)
SIZING_FOUR_BET = re.compile(rf"^{SEAT_OR_BB}\s+4B\s+{_SIZE}$", re.IGNORECASE)
SIZING_VS_4BET = re.compile(rf"^vs\s+4B\s+{_SIZE}$", re.IGNORECASE)
SIZING_VS_3BET = re.compile(rf"^vs\s+3B\s+{SEAT_OR_BB}\s+{_SIZE}$", re.IGNORECASE)
SIZING_VS_OPEN = re.compile(rf"^vs\s+RFI\s+{SEAT_OR_BB}\s+{_SIZE}$", re.IGNORECASE)

# A barra lateral tem uma coluna de tamanhos para o vilão regular e, em muitas abas, outra
# (a mais à esquerda, na coluna 0) para o fish. Os spots contra regular ignoram a do fish.
FISH_SIDEBAR_COLUMN = 0
# O que a coluna do fish traz: o open e o 3bet do fish, por posição.
FISH_KINDS = ("vs3bet", "vsOpen")

# Tamanhos que cada família exige da aba. A família vs-4bet também precisa do `threeBet`,
# mas ele não está na aba: vem do RFI do vilão (ver derive_sizings).
REQUIRED_SIZINGS = {
    "rfi": ("open",),
    "3bet": ("threeBet", "vs4bet"),
    "bb-defense": ("threeBet", "vs4bet"),
    "vs-3bet": ("open", "fourBet"),
    "vs-4bet": ("vs4bet",),
    "vs-jam": ("open",),
}
# E o tamanho da aposta do vilão que o Hero enfrenta, por posição do vilão.
REQUIRED_VILLAIN_SIZING = {"3bet": "vsOpen", "bb-defense": "vsOpen", "vs-3bet": "vs3bet", "vs-4bet": "vsOpen"}
SIZING_KEY_ORDER = ("open", "threeBet", "fourBet", "vs4bet", "vs3bet", "vsOpen")


class SizingShape(NamedTuple):
    """Uma forma da barra lateral que descreve um tamanho de aposta."""

    column: int | None
    kind: str
    position: str | None  # só nos tipos que citam uma posição
    size: float | int


def parse_sizing(column: int | None, text: str) -> SizingShape | None:
    """Interpreta o texto de uma forma como um tamanho de aposta, ou None se não for um."""
    if match := SIZING_OPEN.match(text):
        return SizingShape(column, "open", None, parse_decimal(match.group(1)))
    if match := SIZING_VS_4BET.match(text):
        return SizingShape(column, "vs4bet", None, parse_decimal(match.group(1)))
    for kind, pattern in (
        ("threeBet", SIZING_THREE_BET),
        ("fourBet", SIZING_FOUR_BET),
        ("vs3bet", SIZING_VS_3BET),
        ("vsOpen", SIZING_VS_OPEN),
    ):
        if match := pattern.match(text):
            position = normalize_position(match.group(1).upper())
            return SizingShape(column, kind, position, parse_decimal(match.group(2)))
    return None


def by_position_order(by_position: dict) -> dict:
    """Mesma ordem de posições sempre, para o JSON ser estável."""
    return {position: by_position[position] for position in POSITION_ORDER if position in by_position}


def ordered_sizings(sizings: dict) -> dict:
    """Mesma ordem de chaves sempre, para o JSON ser estável."""
    return {key: sizings[key] for key in SIZING_KEY_ORDER if key in sizings}


def read_sizings(drawings: DrawingReader, spot: dict) -> dict:
    """Tamanhos de um spot contra regular, lidos das formas da aba."""
    sheet_name = spot["sourceSheet"]
    regular: list[SizingShape] = []
    for column, text in drawings.shapes(sheet_name):
        shape = parse_sizing(column, text)
        if shape is None:
            continue
        if column is None:
            raise ConversionError(f"aba '{sheet_name}': a forma '{text}' não tem posição na aba")
        if column != FISH_SIDEBAR_COLUMN:
            regular.append(shape)

    sizings: dict = {}
    for kind in ("open", "threeBet", "fourBet", "vs4bet"):
        found = [shape for shape in regular if shape.kind == kind]
        if len(found) > 1:
            raise ConversionError(
                f"aba '{sheet_name}': achei {len(found)} formas de tamanho '{kind}', esperava no máximo uma"
            )
        if found:
            if found[0].position is not None and found[0].position != spot["hero"]:
                raise ConversionError(
                    f"aba '{sheet_name}': o tamanho '{kind}' é do {found[0].position}, e não do Hero ({spot['hero']})"
                )
            sizings[kind] = found[0].size
    for kind in ("vs3bet", "vsOpen"):
        by_position: dict[str, float | int] = {}
        for shape in (s for s in regular if s.kind == kind):
            if shape.position in by_position:
                raise ConversionError(f"aba '{sheet_name}': tamanho repetido para '{kind}' {shape.position}")
            by_position[shape.position] = shape.size
        sizings[kind] = by_position_order(by_position)

    missing = [kind for kind in REQUIRED_SIZINGS[spot["family"]] if kind not in sizings]
    villain_kind = REQUIRED_VILLAIN_SIZING.get(spot["family"])
    if villain_kind and spot["villain"]["position"] not in sizings[villain_kind]:
        missing.append(f"{villain_kind}[{spot['villain']['position']}]")
    if missing:
        raise ConversionError(f"aba '{sheet_name}': faltam as formas de tamanho {', '.join(missing)}")
    return ordered_sizings(sizings)


def empty_fish_table() -> dict[str, dict[str, float | int]]:
    return {kind: {} for kind in FISH_KINDS}


def read_fish_sizings(drawings: DrawingReader, sheet_name: str) -> dict[str, dict[str, float | int]]:
    """Tamanhos do fish na coluna "vs FISH" da barra lateral de uma aba contra regular.

    As abas contra fish não trazem número nenhum (só rótulos como "vs RFI UTG"). Os tamanhos do
    fish ficam nessa coluna das abas contra regular: o open do fish (vs RFI) e o 3bet do fish (vs 3B).
    """
    found = empty_fish_table()
    for column, text in drawings.shapes(sheet_name):
        if column != FISH_SIDEBAR_COLUMN:
            continue
        shape = parse_sizing(column, text)
        if shape is None:
            continue
        if shape.kind not in found:
            raise ConversionError(f"aba '{sheet_name}': forma inesperada na coluna do fish: '{text}'")
        found[shape.kind][shape.position] = shape.size
    return found


def merge_fish_sizings(table: dict[str, dict[str, float | int]], found: dict, sheet_name: str) -> None:
    """Junta os tamanhos de fish de uma aba aos do Hero. Dois valores diferentes para o mesmo caso falham."""
    for kind, by_position in found.items():
        for position, size in by_position.items():
            if table[kind].get(position, size) != size:
                raise ConversionError(
                    f"aba '{sheet_name}': o tamanho do fish '{kind}' {position} ({size}bb) conflita com "
                    f"outra aba do mesmo Hero ({table[kind][position]}bb)"
                )
            table[kind][position] = size


def fish_sizings_of(table: dict[str, dict[str, float | int]]) -> dict:
    """Os tamanhos de fish de um Hero, na ordem estável do JSON."""
    return {kind: by_position_order(table[kind]) for kind in FISH_KINDS}


def derive_sizings(spots: list[dict]) -> None:
    """Completa o `threeBet` dos spots de vs 4bet com o que o RFI do vilão diz enfrentar.

    A aba de "enfrentar 4bet depois de dar 3bet" traz o 4bet e o open do vilão, mas não o
    3bet que o próprio Hero deu. Esse tamanho está na aba de RFI do vilão ("vs 3B <Hero>").
    """
    regular = [spot for spot in spots if spot["villain"]["type"] == "regular"]
    rfi_by_hero = {spot["hero"]: spot for spot in regular if spot["family"] == "rfi"}
    for spot in regular:
        if spot["family"] != "vs-4bet":
            continue
        villain = spot["villain"]["position"]
        size = rfi_by_hero.get(villain, {}).get("sizings", {}).get("vs3bet", {}).get(spot["hero"])
        if size is None:
            raise ConversionError(
                f"aba '{spot['sourceSheet']}': o RFI do {villain} não diz o 3bet do {spot['hero']}, "
                "então não dá para completar o tamanho do 3bet"
            )
        spot["sizings"] = ordered_sizings({**spot["sizings"], "threeBet": size})
