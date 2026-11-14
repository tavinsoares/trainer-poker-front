"""Textos das formas desenhadas sobre as abas.

Os tamanhos de aposta ficam em formas (caixas de texto), que a leitura de células do openpyxl
descarta. Por isso o desenho é lido direto do XML do arquivo da planilha (um zip).
"""

from __future__ import annotations

import posixpath
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}


class DrawingReader:
    """Lê os textos das formas de cada aba direto do arquivo da planilha."""

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
