import { DydxClient, Market } from '@dydxprotocol/v3-client'
import { Queue } from 'bullmq'
import WebSocket from 'ws'

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
    const queue = new Queue('dydx-ws', {
        connection: {
            host: 'localhost',
            port: 6379,
        },
    })

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

        if (data.channel) {
            queue.add(data.channel, data, {
                removeOnComplete: true,
                attempts: 2,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            })
        }
    })

    ws.on('error', (error) => {
        console.error(error)
    })

    return ws
}
