import { DydxClient, Market } from '@dydxprotocol/v3-client'
import WebSocket from 'ws'
import {
    handleMarketsWSMessage,
    handleOrderbookWSMessage,
} from '../execution/calculations'

export interface WebSocketMessage {
    type: 'subscribed' | 'channel_data'
    channel: 'v3_accounts' | 'v3_orderbook' | 'v3_trades' | 'v3_markets'
    id: string
    contents: any
}

export let client: DydxClient
export let ws: WebSocket

export function initClient(httpHost: string) {
    client = new DydxClient(httpHost)
}

export function initWSClient(wsHost: string) {
    ws = new WebSocket(wsHost)

    const marketsMessage = {
        type: 'subscribe',
        channel: 'v3_markets',
    }

    ws.on('open', () => {
        ws.send(JSON.stringify(marketsMessage))

        for (const market of Object.values(Market)) {
            const orderbookMessage = {
                type: 'subscribe',
                channel: 'v3_orderbook',
                id: market,
                includeOffsets: true,
            }
            ws.send(JSON.stringify(orderbookMessage))
        }
    })

    ws.on('message', async (rawData) => {
        const data = JSON.parse(rawData.toString()) as WebSocketMessage

        switch (data.channel) {
            case 'v3_markets':
                await handleMarketsWSMessage(data)
                break
            case 'v3_orderbook':
                await handleOrderbookWSMessage(data)
                break
        }
    })

    ws.on('error', (error) => {
        console.log(error)
    })

    return ws
}
