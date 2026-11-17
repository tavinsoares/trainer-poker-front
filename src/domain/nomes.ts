import type { Action, SpotFamily } from '../data/ranges-types.ts'

// Nomes de exibição das ações (spec 2), compartilhados entre os botões do drill, o feedback e a
// matriz (spec 3), para que nunca divirjam.

/** O nome do raise do Hero na família: "Open" no RFI, "3bet" no 3bet e na defesa do BB, "4bet" no vs 3bet. */
export const rotuloDoRaise = (family: SpotFamily): string | null => {
  switch (family) {
    case 'rfi':
      return 'Open'
    case '3bet':
    case 'bb-defense':
      return '3bet'
    case 'vs-3bet':
      return '4bet'
    default:
      // vs 4bet e vs jam não têm raise: a agressão do Hero no vs 4bet é o jam.
      return null
  }
}

/** O nome de exibição de uma ação num spot da família. Raise sem rótulo na família é erro de dados. */
export const nomeDaAcao = (family: SpotFamily, action: Action): string => {
  switch (action) {
    case 'raise': {
      const rotulo = rotuloDoRaise(family)
      if (rotulo === null) throw new Error(`a família ${family} não tem raise`)
      return rotulo
    }
    case 'jam':
      return 'Jam'
    case 'call':
      return 'Call'
    case 'fold':
      return 'Fold'
    case 'out_of_range':
      return 'Fora do range'
  }
}
