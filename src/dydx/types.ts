import { MarketResponseObject } from '@dydxprotocol/v3-client'

export interface MarketsResponseObject {
    [market: string]: Partial<MarketResponseObject>
}

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
export interface WebSocketMessage {
    type: 'subscribed' | 'channel_data'
    channel: 'v3_accounts' | 'v3_orderbook' | 'v3_trades' | 'v3_markets'
    id: string
    contents: any
}
