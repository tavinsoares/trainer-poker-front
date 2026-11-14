"""Leitura da planilha de ranges do Metagame, por responsabilidade.

- `errors`: o erro de conversão.
- `positions` e `decimals`: vocabulário compartilhado (posições da mesa e números da planilha).
- `sheets`: o que cada nome de aba significa (qual spot é, ou por que fica de fora).
- `grid`: a matriz 13x13, a legenda, as cores e o EV de cada aba.
- `drawings` e `sizings`: os tamanhos de aposta, que ficam em formas desenhadas sobre a aba.

A orquestração e a linha de comando ficam em `tools/convert_ranges.py`.
"""
