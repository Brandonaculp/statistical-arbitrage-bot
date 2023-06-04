import { ApiKeyCredentials, DydxClient, Market } from '@dydxprotocol/v3-client'
import { RequestMethod } from '@dydxprotocol/v3-client/build/src/lib/axios'
import { Queue } from 'bullmq'
import WS from 'ws'

import { WebSocketMessage } from './types'

export class WebSocket {
    constructor(
        wsHost: string,
        client: DydxClient,
        apiKey: ApiKeyCredentials,
        queue: Queue
    ) {
        const ws = new WS(wsHost)

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

        ws.on('open', () => {
            ws.send(JSON.stringify(marketsMessage))
            ws.send(JSON.stringify(accountsMessage))
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
    }
}
