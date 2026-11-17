import type { RangesData } from './ranges-types.ts'
import rangesJson from '../../data/ranges.json'

// Os ranges gerados pelo conversor (spec 1), tipados. O JSON vem no pacote: não há carregamento.
export const ranges = rangesJson as unknown as RangesData
