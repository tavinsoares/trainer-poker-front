"""Converte a planilha de ranges do Metagame em JSON estático para o app.

Uso (a partir da raiz do projeto do front-end):

    python tools/convert_ranges.py [planilha.xlsx] [--output saida.json] [--imported-at AAAA-MM-DD]

O app nunca lê a planilha em tempo de execução: ele só lê o JSON gerado.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import posixpath
import re
import sys
import zipfile
from datetime import date
from pathlib import Path
from typing import NamedTuple
from xml.etree import ElementTree as ET

import openpyxl

SCHEMA_VERSION = 1
SOURCE_NAME = "Metagame · Ranges Simplificados"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# O meta-repo guarda a planilha em docs/context, dois níveis acima do projeto.
DEFAULT_SOURCE = PROJECT_ROOT.parent.parent / "docs" / "context" / "Ranges Simplificados Metagame.xlsx"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "ranges.json"

# A planilha chama o HJ de MP.
POSITION_ALIASES = {"MP": "HJ"}
RFI_SHEET = re.compile(r"^RFI (UTG|MP|CO|BTN|SB)$")


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
    "FOLD": "fold",
}


class ConversionError(Exception):
    """Erro de conversão. A mensagem sempre cita a aba."""


# Sizings: ficam em formas (caixas de texto) desenhadas sobre a aba, que a leitura
# de células do openpyxl descarta. Por isso o desenho é lido direto do XML do .xlsx.
NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg": "http://schemas.openxmlformats.org/package/2006/relationships",
    "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}
POSITION_ORDER = ["UTG", "HJ", "CO", "BTN", "SB", "BB"]
_POSITION = r"(UTG|MP|HJ|CO|BTN|SB|BB)"
_SIZE = r"(\d+(?:[.,]\d+)?)\s*bb"
SIZING_OPEN = re.compile(rf"^RFI\s+{_SIZE}$", re.IGNORECASE)
SIZING_VS_3BET = re.compile(rf"^vs\s+3B\s+{_POSITION}\s+{_SIZE}$", re.IGNORECASE)
SIZING_VS_OPEN = re.compile(rf"^vs\s+RFI\s+{_POSITION}\s+{_SIZE}$", re.IGNORECASE)


def parse_decimal(text: str) -> float | int:
    """Número com vírgula ou ponto decimal. Inteiros voltam como int (2, e não 2.0).

    Levanta ValueError se o texto não for um número finito.
    """
    value = float(text.strip().replace(",", "."))
    if not math.isfinite(value):
        raise ValueError(text)
    return int(value) if value.is_integer() else value


class SizingShape(NamedTuple):
    """Uma forma da barra lateral que descreve um tamanho de aposta."""

    column: int
    kind: str  # "open", "vs3bet" ou "vsOpen"
    position: str | None
    size: float | int


class DrawingReader:
    """Lê os textos das formas de cada aba direto do arquivo da planilha (um zip de XMLs)."""

    def __init__(self, source: Path):
        self._zip = zipfile.ZipFile(source)
        workbook = ET.fromstring(self._zip.read("xl/workbook.xml"))
        relations = ET.fromstring(self._zip.read("xl/_rels/workbook.xml.rels"))
        targets = {rel.get("Id"): rel.get("Target") for rel in relations}
        self._sheet_paths = {}
        for sheet in workbook.find("main:sheets", NS):
            target = targets[sheet.get(f"{{{NS['rel']}}}id")]
            path = target[1:] if target.startswith("/") else posixpath.normpath(posixpath.join("xl", target))
            self._sheet_paths[sheet.get("name")] = path

    def _drawing_path(self, sheet_name: str) -> str | None:
        sheet_path = self._sheet_paths[sheet_name]
        rels_path = posixpath.join(posixpath.dirname(sheet_path), "_rels", posixpath.basename(sheet_path) + ".rels")
        if rels_path not in self._zip.namelist():
            return None
        for rel in ET.fromstring(self._zip.read(rels_path)):
            if rel.get("Type", "").endswith("/drawing"):
                return posixpath.normpath(posixpath.join(posixpath.dirname(sheet_path), rel.get("Target")))
        return None

    def shapes(self, sheet_name: str) -> list[tuple[int | None, str]]:
        """Devolve (coluna de ancoragem, texto) de cada forma com texto da aba."""
        drawing = self._drawing_path(sheet_name)
        if drawing is None:
            return []
        shapes = []
        for anchor in ET.fromstring(self._zip.read(drawing)):
            paragraphs = []
            for paragraph in anchor.iter(f"{{{NS['a']}}}p"):
                text = "".join(run.text or "" for run in paragraph.iter(f"{{{NS['a']}}}t"))
                if text.strip():
                    paragraphs.append(text.strip())
            if not paragraphs:
                continue
            origin = anchor.find("xdr:from", NS)
            column = int(origin.find("xdr:col", NS).text) if origin is not None else None
            shapes.append((column, re.sub(r"\s+", " ", " ".join(paragraphs))))
        return shapes

    def close(self) -> None:
        self._zip.close()


def read_sizings(drawings: DrawingReader, sheet_name: str) -> dict:
    """Sizings do vilão regular de um RFI: o open do Hero e os 3bets e opens enfrentados.

    A barra lateral tem uma coluna para o vilão regular e, em algumas abas, outra para o
    fish. A do regular é a que contém o "RFI Xbb" do próprio Hero; a outra é ignorada.
    """
    parsed: list[SizingShape] = []
    for column, text in drawings.shapes(sheet_name):
        for kind, pattern in (("open", SIZING_OPEN), ("vs3bet", SIZING_VS_3BET), ("vsOpen", SIZING_VS_OPEN)):
            match = pattern.match(text)
            if not match:
                continue
            if column is None:
                raise ConversionError(f"aba '{sheet_name}': a forma '{text}' não tem posição na aba")
            if kind == "open":
                parsed.append(SizingShape(column, kind, None, parse_decimal(match.group(1))))
            else:
                position = normalize_position(match.group(1).upper())
                parsed.append(SizingShape(column, kind, position, parse_decimal(match.group(2))))

    open_shapes = [shape for shape in parsed if shape.kind == "open"]
    if len(open_shapes) != 1:
        raise ConversionError(
            f"aba '{sheet_name}': esperava uma forma 'RFI Xbb' (open do Hero), achei {len(open_shapes)}"
        )
    regular_column, open_size = open_shapes[0].column, open_shapes[0].size

    sizings: dict = {"open": open_size, "vs3bet": {}, "vsOpen": {}}
    for column, kind, position, size in parsed:
        if column != regular_column or kind == "open":
            continue
        if position in sizings[kind]:
            raise ConversionError(f"aba '{sheet_name}': tamanho repetido para '{kind}' {position}")
        sizings[kind][position] = size
    for kind in ("vs3bet", "vsOpen"):
        sizings[kind] = {p: sizings[kind][p] for p in POSITION_ORDER if p in sizings[kind]}
    return sizings


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


def read_hands(sheet, legend: dict[str, dict]) -> list[dict]:
    """Lê as 169 mãos da matriz, na ordem da matriz (linha por linha)."""
    check_grid_bounds(sheet)
    hands = []
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
            if key not in legend:
                raise ConversionError(
                    f"aba '{sheet.title}': a cor da célula {cell.coordinate} ({expected}) não consta da legenda"
                )
            entry = legend[key]
            hands.append(
                {
                    "hand": expected,
                    "action": entry["action"],
                    "label": entry["label"],
                    "combos": combos_of(expected),
                    "ev": read_ev(sheet, cell),
                }
            )
    return hands


def normalize_position(raw: str) -> str:
    return POSITION_ALIASES.get(raw, raw)


def classify_sheet(sheet_name: str) -> dict | None:
    """Devolve a identidade do spot de uma aba, ou None se a aba não é tratada ainda."""
    match = RFI_SHEET.match(sheet_name)
    if match:
        hero = normalize_position(match.group(1))
        return {
            "id": f"rfi-{hero.lower()}-regular",
            "family": "rfi",
            "hero": hero,
            "villain": {"type": "regular", "position": None},
            "sourceSheet": sheet_name,
        }
    return None


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def convert(source: Path, imported_at: str) -> tuple[dict, list[str]]:
    """Converte a planilha. Devolve o JSON e os nomes das abas ainda não tratadas."""
    workbook = openpyxl.load_workbook(source)
    drawings = DrawingReader(source)
    spots = []
    skipped = []
    try:
        for sheet_name in workbook.sheetnames:
            identity = classify_sheet(sheet_name)
            if identity is None:
                skipped.append(sheet_name)
                continue
            sheet = workbook[sheet_name]
            legend = read_legend(sheet)
            spots.append(
                {
                    **identity,
                    "sizings": read_sizings(drawings, sheet_name),
                    "legend": list(legend.values()),
                    "hands": read_hands(sheet, legend),
                }
            )
    finally:
        drawings.close()
    data = {
        "manifest": {
            "source": SOURCE_NAME,
            "importedAt": imported_at,
            "schemaVersion": SCHEMA_VERSION,
            "sourceSha256": sha256_of(source),
        },
        "spots": spots,
    }
    return data, skipped


def write_json(data: dict, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    # LF e sem espaços extras: o arquivo é commitado e precisa ser estável entre máquinas.
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    with output.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", nargs="?", type=Path, default=DEFAULT_SOURCE, help="caminho da planilha")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="caminho do JSON de saída")
    parser.add_argument("--imported-at", default=date.today().isoformat(), help="data de importação (AAAA-MM-DD)")
    args = parser.parse_args(argv)

    if not args.source.is_file():
        print(f"Planilha não encontrada: {args.source}", file=sys.stderr)
        return 2
    try:
        data, skipped = convert(args.source, args.imported_at)
    except ConversionError as error:
        print(f"Erro de conversão: {error}", file=sys.stderr)
        return 1

    write_json(data, args.output)
    print(f"sha256 da planilha: {data['manifest']['sourceSha256']}")
    print(f"{len(data['spots'])} spots escritos em {args.output}")
    print(f"{len(skipped)} abas ainda não tratadas (virão nos próximos tickets da spec 1)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
