import { DydxClient } from '@dydxprotocol/v3-client'
import WebSocket from 'ws'
import { handleMarketsWSMessage } from '../execution/calculations'

interface WebSocketMessage {
    type: 'subscribed' | 'channel_data'
    channel: 'v3_accounts' | 'v3_orderbook' | 'v3_trades' | 'v3_markets'
    contents: any
}

export let client: DydxClient
export let ws: WebSocket

export function initClient(httpHost: string) {
    client = new DydxClient(httpHost)
}

export function initWSClient(wsHost: string) {
    ws = new WebSocket(wsHost)

    const message = {
        type: 'subscribe',
        channel: 'v3_markets',
    }

    ws.on('open', () => {
        ws.send(JSON.stringify(message))
    })

    ws.on('message', (rawData) => {
        const data = JSON.parse(rawData.toString()) as WebSocketMessage

        switch (data.channel) {
            case 'v3_markets':
                handleMarketsWSMessage(data.contents)
                break
            case 'v3_orderbook':
        }
    })
}
