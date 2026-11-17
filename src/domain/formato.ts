import type { RangesData } from '../data/ranges-types.ts'

// Formatação em português para as telas (spec 5): números com vírgula e datas no padrão brasileiro.

/** 6.8 → "6,8". */
export const numeroBr = (n: number): string => String(n).replace('.', ',')

/** 6.8 → "6,8 bb". */
export const bbBr = (n: number): string => `${numeroBr(n)} bb`

/** 46.5 → "46,5%". */
export const percentualBr = (n: number): string => `${numeroBr(n)}%`

/** "2026-11-14" → "14/11/2026". */
export const dataBr = (iso: string): string => iso.split('-').reverse().join('/')

/** Data e hora ISO 8601 → "16/11/2026 10:00", no fuso do navegador. */
export const dataHoraBr = (iso: string): string =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)).replace(',', '')

/** O que a tela de Config diz da origem dos ranges, lido do manifesto e dos spots. */
export interface OrigemDosRanges {
  fonte: string
  formato: string
  importadoEm: string
  spots: number
  contraRegular: number
  contraFish: number
}

export function origemDosRanges(dados: RangesData): OrigemDosRanges {
  return {
    fonte: dados.manifest.source,
    formato: '6-max · 100bb · cash',
    importadoEm: dataBr(dados.manifest.importedAt),
    spots: dados.spots.length,
    contraRegular: dados.spots.filter((s) => s.villain.type === 'regular').length,
    contraFish: dados.spots.filter((s) => s.villain.type === 'fish').length,
  }
}
