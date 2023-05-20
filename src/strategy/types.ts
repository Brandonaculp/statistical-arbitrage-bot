import type { CandleResponseObject } from '@dydxprotocol/v3-client'

export interface MarketsPrices {
    [market: string]: CandleResponseObject[]
}

export interface CointResult {
    cointFlag: boolean
    pValue: number
    tValue: number
    criticalValue: number
    hedgeRatio: number
    zeroCrossing: number
}
