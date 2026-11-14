"""O que cada nome de aba significa: qual spot é, ou por que a aba fica de fora da v1."""

from __future__ import annotations

import re

from .positions import POSITION_ORDER, SEAT, SEAT_OR_BB, normalize_position

# Nomes de aba tratados. Em "X vY", X é o Hero e Y é quem abriu. Abas com sufixo (por
# exemplo "BBvUTG 2.5", uma variante de tamanho de aposta) não casam e ficam de fora.
RFI_SHEET = re.compile(r"^RFI (UTG|MP|CO|BTN|SB)$")
THREE_BET_SHEET = re.compile(rf"^3B {SEAT}v{SEAT}$")
BB_DEFENSE_SHEET = re.compile(rf"^BBv{SEAT}$")
# Enfrentar agressão: o Hero é quem abriu (vs 3B e vs JAM) ou quem deu o 3bet (vs 4B).
VS_AGGRESSION_SHEET = re.compile(rf"^{SEAT_OR_BB}v(3B|4B|JAM) {SEAT_OR_BB}$")
VS_AGGRESSION_FAMILIES = {"3B": "vs-3bet", "4B": "vs-4bet", "JAM": "vs-jam"}
# Contra fish: o mesmo nome da aba de regular, com " F" no fim. E o RFI contra fish, que só BTN e SB têm.
FISH_VS_SHEET = re.compile(rf"^{SEAT_OR_BB}v{SEAT_OR_BB} F$")
FISH_VS_AGGRESSION_SHEET = re.compile(rf"^{SEAT_OR_BB}v(4B|JAM) {SEAT_OR_BB} F$")
FISH_RFI_SHEET = re.compile(r"^OR (BTN|SB)vF$")


def spot_identity(
    family: str, hero: str, villain_position: str | None, sheet_name: str, villain_type: str = "regular"
) -> dict:
    """Identidade de um spot. O id é estável e legível."""
    hero = normalize_position(hero)
    villain_position = normalize_position(villain_position) if villain_position else None
    target = f"-vs-{villain_position.lower()}" if villain_position else ""
    return {
        "id": f"{family}-{hero.lower()}{target}-{villain_type}",
        "family": family,
        "hero": hero,
        "villain": {"type": villain_type, "position": villain_position},
        "sourceSheet": sheet_name,
    }


def classify_sheet(sheet_name: str) -> dict | None:
    """Devolve a identidade do spot de uma aba, ou None se a aba não é um spot da v1."""
    if match := RFI_SHEET.match(sheet_name):
        return spot_identity("rfi", match.group(1), None, sheet_name)
    if match := THREE_BET_SHEET.match(sheet_name):
        return spot_identity("3bet", match.group(1), match.group(2), sheet_name)
    if match := BB_DEFENSE_SHEET.match(sheet_name):
        return spot_identity("bb-defense", "BB", match.group(1), sheet_name)
    if match := VS_AGGRESSION_SHEET.match(sheet_name):
        return spot_identity(VS_AGGRESSION_FAMILIES[match.group(2)], match.group(1), match.group(3), sheet_name)
    # Contra fish. As abas "X vY F" não dizem se o Hero enfrenta um open ou um 3bet: a família sai
    # da ordem de ação. Quem age depois de Y enfrenta o open dele (3bet, ou defesa do BB); quem age
    # antes de Y enfrenta o 3bet dele. A suíte confere a regra pelos rótulos de legenda de cada aba.
    if match := FISH_VS_SHEET.match(sheet_name):
        hero, villain = normalize_position(match.group(1)), normalize_position(match.group(2))
        if POSITION_ORDER.index(hero) > POSITION_ORDER.index(villain):
            family = "bb-defense" if hero == "BB" else "3bet"
        else:
            family = "vs-3bet"
        return spot_identity(family, hero, villain, sheet_name, villain_type="fish")
    if match := FISH_VS_AGGRESSION_SHEET.match(sheet_name):
        return spot_identity(
            VS_AGGRESSION_FAMILIES[match.group(2)], match.group(1), match.group(3), sheet_name, villain_type="fish"
        )
    if match := FISH_RFI_SHEET.match(sheet_name):
        return spot_identity("rfi", match.group(1), None, sheet_name, villain_type="fish")
    return None


def classify_exclusion(sheet_name: str) -> str | None:
    """Motivo pelo qual uma aba que não é spot da v1 fica de fora, ou None se o nome é desconhecido.

    Um nome desconhecido faz a conversão falhar: nenhuma aba some sem registro.
    """
    if sheet_name.startswith("3H "):
        return "3-handed"
    if sheet_name.startswith("HU "):
        return "heads-up"
    if "SQZ" in sheet_name:
        return "squeeze"
    if "C4B" in sheet_name:
        return "cold 4bet"
    # Variante de tamanho de aposta: o nome de um spot da v1 com um número no fim ("BBvUTG 2.5").
    base = re.fullmatch(r"(.+) \d+(?:\.\d+)?", sheet_name)
    if base and classify_sheet(base.group(1)):
        return "variante de tamanho de aposta"
    return None
