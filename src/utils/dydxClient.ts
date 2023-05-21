import { DydxClient, Market } from '@dydxprotocol/v3-client'
import { Queue } from 'bullmq'
import WebSocket from 'ws'
import Web3 from 'web3'
import { RequestMethod } from '@dydxprotocol/v3-client/build/src/lib/axios'

export interface WebSocketMessage {
    type: 'subscribed' | 'channel_data'
    channel: 'v3_accounts' | 'v3_orderbook' | 'v3_trades' | 'v3_markets'
    id: string
    contents: any
}

export let client: DydxClient
export let ws: WebSocket

export async function initClients(httpHost: string, wsHost: string) {
    const web3 = new Web3()
    web3.eth.accounts.wallet.add(process.env.ETHEREUM_PRIVATE_KEY!)

    // @ts-ignore
    client = new DydxClient(httpHost, { web3: web3 })

    const accountAddress = web3.eth.accounts.wallet[0].address
    const apiCreds = await client.onboarding.recoverDefaultApiCredentials(
        accountAddress
    )
    client.apiKeyCredentials = apiCreds

    const queue = new Queue('dydx-ws', {
        connection: {
            host: 'localhost',
            port: 6379,
        },
    })

    ws = new WebSocket(wsHost)

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
        apiKey: apiCreds.key,
        signature,
        timestamp,
        passphrase: apiCreds.passphrase,
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

    return ws
}
