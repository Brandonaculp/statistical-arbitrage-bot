import {
    DydxClient,
    Market,
    OnboardingActionString,
    SignOnboardingAction,
    SigningMethod,
} from '@dydxprotocol/v3-client'
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
    const web3 = new Web3(
        new Web3.providers.HttpProvider(
            'https://ethereum-goerli.publicnode.com'
        )
    )
    web3.eth.accounts.wallet.add(process.env.ETHEREUM_PRIVATE_KEY!)
    const accountAddress = web3.eth.accounts.wallet[0].address

    client = new DydxClient(httpHost, {
        // @ts-ignore
        web3,
        networkId: 5,
        apiKeyCredentials: {
            key: 'f9fe5a84-f03d-cd87-c1c7-41e9ad64732d',
            secret: 'hAc8ZchZd9S5_RO2M5J4zMe1jkUY7FI7EUm0yjoV',
            passphrase: 'xOoyJ3unzYByTlHoW8uH',
        },
    })

    // const keyPair = await client.onboarding.deriveStarkKey(accountAddress)

    // @ts-ignore
    // const signer = new SignOnboardingAction(web3, 5)

    // const signature = await signer.sign(accountAddress, SigningMethod.Hash, {
    //     action: OnboardingActionString.ONBOARDING,
    // })

    // const { user, apiKey, account } = await client.onboarding.createUser(
    //     {
    //         starkKey: keyPair.publicKey,
    //         starkKeyYCoordinate: keyPair.publicKeyYCoordinate,
    //         country: 'DE',
    //     },
    //     accountAddress,
    //     signature
    // )

    // const apiKey = await client.onboarding.recoverDefaultApiCredentials(
    //     accountAddress
    // )

    // client.apiKeyCredentials = apiKey

    const apiKeys = await client.private.getApiKeys()

    // const queue = new Queue('dydx-ws', {
    //     connection: {
    //         host: 'localhost',
    //         port: 6379,
    //     },
    // })

    // ws = new WebSocket(wsHost)

    // const timestamp = new Date().toISOString()
    // const signature = client.private.sign({
    //     requestPath: '/ws/accounts',
    //     method: RequestMethod.GET,
    //     isoTimestamp: timestamp,
    // })

    // const accountsMessage = {
    //     type: 'subscribe',
    //     channel: 'v3_accounts',
    //     accountNumber: '0',
    //     apiKey: apiKey.key,
    //     signature,
    //     timestamp,
    //     passphrase: apiKey.passphrase,
    // }

    // const marketsMessage = {
    //     type: 'subscribe',
    //     channel: 'v3_markets',
    // }

    // ws.on('open', () => {
    //     ws.send(JSON.stringify(marketsMessage))
    //     ws.send(JSON.stringify(accountsMessage))
    //     for (const market of Object.values(Market)) {
    //         const orderbookMessage = {
    //             type: 'subscribe',
    //             channel: 'v3_orderbook',
    //             id: market,
    //             includeOffsets: true,
    //         }
    //         ws.send(JSON.stringify(orderbookMessage))
    //     }
    // })

    // ws.on('message', async (rawData) => {
    //     const data = JSON.parse(rawData.toString()) as WebSocketMessage

    //     if (data.channel === 'v3_accounts') {
    //         console.log(data)
    //     }

    //     if (data.channel) {
    //         queue.add(data.channel, data, {
    //             removeOnComplete: true,
    //             attempts: 2,
    //             backoff: {
    //                 type: 'exponential',
    //                 delay: 1000,
    //             },
    //         })
    //     }
    // })

    // ws.on('error', (error) => {
    //     console.error(error)
    // })

    return { client, ws }
}
