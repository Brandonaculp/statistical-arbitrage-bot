import {
    ApiKeyCredentials,
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
import { Separator, input, password, select } from '@inquirer/prompts'
import { prisma } from './prismaClient'
import { Network } from '@prisma/client'

export interface WebSocketMessage {
    type: 'subscribed' | 'channel_data'
    channel: 'v3_accounts' | 'v3_orderbook' | 'v3_trades' | 'v3_markets'
    id: string
    contents: any
}

export let client: DydxClient
export let ws: WebSocket

const networkId = {
    [Network.MAINNET]: 1,
    [Network.TESTNET]: 5,
}

async function createUser(network: Network) {
    if (!client || !client.web3) {
        throw new Error('client not initialized')
    }

    const username = await input({ message: 'Enter username' })
    const privateKey = await password({ message: 'Enter your private key' })

    const userExists = await prisma.user.findFirst({
        where: { privateKey, network },
    })
    if (userExists) {
        throw new Error(`user already exists: ${userExists.username}`)
    }

    client.web3.eth.accounts.wallet.add(privateKey)
    const address = client.web3.eth.accounts.wallet[0].address

    const keyPair = await client.onboarding.deriveStarkKey(address)

    const signer = new SignOnboardingAction(client.web3, networkId[network])
    const signature = await signer.sign(address, SigningMethod.Hash, {
        action: OnboardingActionString.ONBOARDING,
    })

    await client.onboarding.createUser(
        {
            starkKey: keyPair.publicKey,
            starkKeyYCoordinate: keyPair.publicKeyYCoordinate,
            country: 'DE',
        },
        address,
        signature
    )

    const { apiKey } = await client.ethPrivate.createApiKey(address)

    const user = await prisma.user.create({
        data: {
            username,
            address,
            privateKey,
            network,
        },
    })

    await prisma.apiKey.create({
        data: {
            key: apiKey.key,
            secret: apiKey.secret,
            passphrase: apiKey.passphrase,
            userId: user.id,
        },
    })

    return apiKey
}

export async function initClients(httpHost: string, wsHost: string) {
    const network = await select<Network>({
        message: 'Select network',
        choices: [
            {
                name: 'Mainnet',
                value: Network.MAINNET,
            },
            {
                name: 'Testnet',
                value: Network.TESTNET,
            },
        ],
    })

    const httpProvider = await input({
        message: 'Enter ethereum http provider',
        default:
            network === Network.MAINNET
                ? 'https://ethereum.publicnode.com'
                : 'https://ethereum-goerli.publicnode.com',
    })

    const web3 = new Web3(new Web3.providers.HttpProvider(httpProvider))

    client = new DydxClient(httpHost, {
        // @ts-ignore
        web3,
        networkId: networkId[network],
    })

    const users = await prisma.user.findMany({
        where: {
            network,
        },
        include: { apiKeys: true },
    })

    const user = await select<(typeof users)[0] | string>({
        message: 'Select user',
        choices: [
            ...users.map((user) => ({ name: user.username, value: user })),
            new Separator(),
            { name: 'Create new user', value: 'create new user' },
        ],
    })

    let apiKey: ApiKeyCredentials =
        typeof user === 'string' ? await createUser(network) : user.apiKeys[0]

    client.apiKeyCredentials = apiKey

    const queue = new Queue('dydx-ws', {
        connection: {
            host: 'localhost',
            port: 6379,
        },
    })

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

    ws = new WebSocket(wsHost)
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

        if (data.channel === 'v3_accounts') {
            console.log(data)
        }

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

    return { client, ws }
}
