import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Teste mínimo do esqueleto: prova que o comando de validação de dados roda
// e enxerga as pastas de dados e do conversor. A suíte real, que confere as
// invariantes do JSON gerado, chega na spec 1 (ticket "RFI contra regular").
const raiz = resolve(import.meta.dirname, '..', '..')

describe('esqueleto do projeto', () => {
  it('tem uma pasta própria para os dados gerados', () => {
    expect(existsSync(resolve(raiz, 'data'))).toBe(true)
  })

  it('tem uma pasta própria para o conversor, fora do código do app', () => {
    expect(existsSync(resolve(raiz, 'tools'))).toBe(true)
  })
})
