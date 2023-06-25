import { type MarketResponseObject } from '@dydxprotocol/v3-client'

export type MarketsResponseObject = Record<
    string,
    Partial<MarketResponseObject>
>

interface OrderbookResponseOrder {
    price: string
    size: string
    offset: string
}

export interface OrderbookSubscribeResponseObject {
    bids: OrderbookResponseOrder[]
    asks: OrderbookResponseOrder[]
}

export interface OrderbookChannelDataResponseObject {
    offset: string
    bids: Array<[string, string]>
    asks: Array<[string, string]>
}
