import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { RangesData } from '../../src/data/ranges-types.ts'
import { sortearPergunta } from '../../src/domain/sorteio.ts'
import type { Question } from '../../src/domain/tipos.ts'

// Ajudantes das suítes do domínio (spec 2). O JSON real é a base de todos os testes.
export const dados: RangesData = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', 'data', 'ranges.json'), 'utf-8'),
)

export const constante = (valor: number) => () => valor

// PRNG determinístico (mulberry32): amostras grandes sem teste instável.
export const prng = (semente: number) => () => {
  semente = (semente + 0x6d2b79f5) | 0
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const amostra = (n: number, semente: number, base: RangesData = dados) => {
  const rng = prng(semente)
  return Array.from({ length: n }, () => sortearPergunta(base, rng))
}

/**
 * Uma pergunta para cada par (spot, mão) que o sorteio consegue produzir, achada por amostragem
 * com semente fixa (o sorteio de RFI alcança as 845 em 120 mil tentativas).
 */
export const perguntasPorSpotEMao = (n = 120_000, semente = 7): Map<string, Question> => {
  const porChave = new Map<string, Question>()
  for (const pergunta of amostra(n, semente)) {
    const chave = `${pergunta.spot.id}|${pergunta.hand.name}`
    if (!porChave.has(chave)) porChave.set(chave, pergunta)
  }
  return porChave
}
