"""Converte a planilha de ranges do Metagame em JSON estático para o app.

Uso (a partir da raiz do projeto do front-end):

    python tools/convert_ranges.py [planilha.xlsx] [--output saida.json] [--report relatorio.json]
                                   [--imported-at AAAA-MM-DD]

Gera o JSON de ranges e, ao lado dele, o relatório das 332 abas (as que viraram spot e o motivo
de cada aba que ficou de fora). O app nunca lê a planilha em tempo de execução: ele só lê o JSON.

A leitura da planilha está em `tools/ranges/`. Este arquivo só orquestra e cuida da linha de comando.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

import openpyxl

from ranges.drawings import DrawingReader
from ranges.errors import ConversionError
from ranges.grid import read_hands, read_legend
from ranges.sheets import classify_exclusion, classify_sheet
from ranges.sizings import (
    derive_sizings,
    empty_fish_table,
    fish_sizings_of,
    merge_fish_sizings,
    read_fish_sizings,
    read_sizings,
)

SCHEMA_VERSION = 1
SOURCE_NAME = "Metagame · Ranges Simplificados"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# O meta-repo guarda a planilha em docs/context, dois níveis acima do projeto.
DEFAULT_SOURCE = PROJECT_ROOT.parent.parent / "docs" / "context" / "Ranges Simplificados Metagame.xlsx"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "ranges.json"


def build_spot(sheet, identity: dict, sizings: dict, discarded_ev: list[dict]) -> dict:
    """Monta um spot: a legenda e as 169 mãos da aba, mais os tamanhos já lidos."""
    legend = read_legend(sheet)
    hands, discarded = read_hands(sheet, legend)
    discarded_ev.extend(discarded)
    return {**identity, "sizings": sizings, "legend": list(legend.values()), "hands": hands}


def convert(source: Path, imported_at: str) -> tuple[dict, dict]:
    """Converte a planilha. Devolve o JSON de ranges e o inventário de todas as abas."""
    workbook = openpyxl.load_workbook(source)
    drawings = DrawingReader(source)
    spots: list[dict] = []
    excluded: list[dict] = []
    discarded_ev: list[dict] = []
    fish_identities: list[dict] = []
    fish_table_by_hero: dict[str, dict] = {}
    try:
        for sheet_name in workbook.sheetnames:
            identity = classify_sheet(sheet_name)
            if identity is None:
                reason = classify_exclusion(sheet_name)
                if reason is None:
                    raise ConversionError(
                        f"aba '{sheet_name}': não é um spot da v1 nem uma exclusão conhecida "
                        "(3-handed, heads-up, squeeze, cold 4bet ou variante de tamanho de aposta)"
                    )
                excluded.append({"sheet": sheet_name, "reason": reason})
            elif identity["villain"]["type"] == "fish":
                # Fica para depois: os tamanhos do fish vêm das abas contra regular de cada Hero.
                fish_identities.append(identity)
            else:
                spots.append(
                    build_spot(workbook[sheet_name], identity, read_sizings(drawings, identity), discarded_ev)
                )
                table = fish_table_by_hero.setdefault(identity["hero"], empty_fish_table())
                merge_fish_sizings(table, read_fish_sizings(drawings, sheet_name), sheet_name)
        for identity in fish_identities:
            table = fish_table_by_hero.get(identity["hero"], empty_fish_table())
            sheet = workbook[identity["sourceSheet"]]
            spots.append(build_spot(sheet, identity, fish_sizings_of(table), discarded_ev))
    finally:
        drawings.close()
    derive_sizings(spots)

    data = {
        "manifest": {
            "source": SOURCE_NAME,
            "importedAt": imported_at,
            "schemaVersion": SCHEMA_VERSION,
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        },
        "spots": spots,
    }
    imported_sheets = {spot["sourceSheet"] for spot in spots}
    report = {
        "totalSheets": len(workbook.sheetnames),
        "imported": [name for name in workbook.sheetnames if name in imported_sheets],
        "excluded": excluded,
        "discardedGrayEv": discarded_ev,
    }
    return data, report


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
    parser.add_argument(
        "--report", type=Path, help="caminho do relatório das abas (padrão: ao lado do JSON, com .report.json)"
    )
    parser.add_argument("--imported-at", default=date.today().isoformat(), help="data de importação (AAAA-MM-DD)")
    args = parser.parse_args(argv)

    if not args.source.is_file():
        print(f"Planilha não encontrada: {args.source}", file=sys.stderr)
        return 2
    try:
        data, report = convert(args.source, args.imported_at)
    except ConversionError as error:
        print(f"Erro de conversão: {error}", file=sys.stderr)
        return 1

    report_path = args.report or args.output.with_name(args.output.stem + ".report.json")
    write_json(data, args.output)
    write_json(report, report_path)
    print(f"sha256 da planilha: {data['manifest']['sourceSha256']}")
    print(f"{len(data['spots'])} spots escritos em {args.output}")
    by_reason = Counter(item["reason"] for item in report["excluded"])
    print(f"{len(report['excluded'])} de {report['totalSheets']} abas ficaram de fora da v1 (relatório em {report_path}):")
    for reason, count in by_reason.most_common():
        print(f"  {count:3d}  {reason}")
    large = [item for item in report["discardedGrayEv"] if abs(item["ev"]) > 1]
    print(
        f"{len(report['discardedGrayEv'])} EVs de células cinza (fora do range) descartados, "
        f"{len(large)} deles acima de 1bb: confira no relatório."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
