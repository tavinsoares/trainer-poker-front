"""Posições da mesa, como a planilha as escreve."""

# A planilha chama o HJ de MP em alguns nomes de aba e em algumas formas.
POSITION_ALIASES = {"MP": "HJ"}

# Ordem de ação no preflop, do primeiro ao último.
POSITION_ORDER = ("UTG", "HJ", "CO", "BTN", "SB", "BB")

# Fragmentos de expressão regular com as posições, para os nomes de aba e os textos das formas.
SEAT = r"(UTG|MP|HJ|CO|BTN|SB)"
SEAT_OR_BB = r"(UTG|MP|HJ|CO|BTN|SB|BB)"


def normalize_position(raw: str) -> str:
    return POSITION_ALIASES.get(raw, raw)
