import {
    type ApiKeyCredentials,
    type DydxClient,
} from '@dydxprotocol/v3-client'
import { RequestMethod } from '@dydxprotocol/v3-client/build/src/lib/axios'
import { type Market } from '@prisma/client'
import { type Queue } from 'bullmq'
import WebSocket from 'ws'

import { type WebSocketMessage } from './types'

export class DydxWebSocket {
    private readonly ws: WebSocket

    constructor(
        wsHost: string,
        client: DydxClient,
        apiKey: ApiKeyCredentials,
        queue: Queue
    ) {
        this.ws = new WebSocket(wsHost)

        const timestamp = new Date().toISOString()
        const signature = client.private.sign({
            requestPath: '/ws/accounts',
            method: RequestMethod.GET,
            isoTimestamp: timestamp,
        })

        const accountsMessage = {
            type: 'subscribe',
            channel: 'v3_accounts',
            accountNumber: '0',
            apiKey: apiKey.key,
            signature,
            timestamp,
            passphrase: apiKey.passphrase,
        }

        const marketsMessage = {
            type: 'subscribe',
            channel: 'v3_markets',
        }

        this.ws.on('open', () => {
            this.ws.send(JSON.stringify(marketsMessage))
            this.ws.send(JSON.stringify(accountsMessage))
        })

        this.ws.on('message', async (rawData) => {
            const data = JSON.parse(rawData.toString()) as WebSocketMessage

            // TODO: check if data.channel can be undefined or empty string
            if (data.channel !== '') {
                await queue.add(data.channel, data, {
                    removeOnComplete: true,
                    attempts: 2,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                    },
                })
            }
        })

        this.ws.on('error', (error) => {
            console.error(error)
        })
    }

    subscribeOrderbook(...markets: Market[]): void {
        const sendOrderbookSubscription = (): void => {
            for (const market of markets) {
                const orderbookMessage = {
                    type: 'subscribe',
                    channel: 'v3_orderbook',
                    id: market.name,
                    includeOffsets: true,
                }
                this.ws.send(JSON.stringify(orderbookMessage))
            }
        }

        if (this.ws.readyState === WebSocket.OPEN) {
            sendOrderbookSubscription()
        } else {
            this.ws.on('open', sendOrderbookSubscription)
        }
    }

    subscribeTrades(...markets: Market[]): void {
        const sendTradesSubscription = (): void => {
            for (const market of markets) {
                const tradesMessage = {
                    type: 'subscribe',
                    channel: 'v3_trades',
                    id: market.name,
                }
                this.ws.send(JSON.stringify(tradesMessage))
            }
        }

        if (this.ws.readyState === WebSocket.OPEN) {
            sendTradesSubscription()
        } else {
            this.ws.on('open', sendTradesSubscription)
        }
    }
}
