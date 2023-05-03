import type { CandleResponseObject } from '@dydxprotocol/v3-client'

export interface MarketsPrices {
    [market: string]: CandleResponseObject[]
}

export interface CointResult {
    cointFlag: number
    pValue: number
    tValue: number
    criticalValue: number
    hedgeRatio: number
    zeroCrossing: number
}

export interface CointPair extends CointResult {
    sym1: string
    sym2: string
}
