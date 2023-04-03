import { CandleResponseObject } from '@dydxprotocol/v3-client'

export interface MarketsPrices {
    [market: string]: CandleResponseObject[]
}
