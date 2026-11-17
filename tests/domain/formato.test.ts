import { describe, expect, it } from 'vitest'
import { bbBr, dataBr, numeroBr, origemDosRanges, percentualBr } from '../../src/domain/formato.ts'
import { dados } from './auxiliares.ts'

describe('formatação em português e a origem dos ranges (spec 5)', () => {
  it('usa vírgula nos números, no bb e no percentual', () => {
    expect(numeroBr(6.8)).toBe('6,8')
    expect(bbBr(18.6)).toBe('18,6 bb')
    expect(bbBr(0)).toBe('0 bb')
    expect(percentualBr(46.5)).toBe('46,5%')
    expect(percentualBr(100)).toBe('100%')
  })

  it('escreve a data no padrão brasileiro', () => {
    expect(dataBr('2026-11-14')).toBe('14/11/2026')
  })

  it('a origem dos ranges sai do manifesto e dos spots', () => {
    const origem = origemDosRanges(dados)
    expect(origem).toMatchObject({ formato: '6-max · 100bb · cash', spots: 127, contraRegular: 65, contraFish: 62 })
    expect(origem.contraRegular + origem.contraFish).toBe(origem.spots)
    expect(origem.fonte).toBe(dados.manifest.source)
    expect(origem.importadoEm).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })
})
