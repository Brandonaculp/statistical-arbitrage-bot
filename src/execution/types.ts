import { MarketResponseObject } from '@dydxprotocol/v3-client'

export interface MarketsResponseObject {
    [market: string]: Partial<MarketResponseObject>
}
