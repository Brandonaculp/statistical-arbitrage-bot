import { ApiKeyCredentials, DydxClient, Market } from '@dydxprotocol/v3-client'
import { RequestMethod } from '@dydxprotocol/v3-client/build/src/lib/axios'
import { Separator, input, password, select } from '@inquirer/prompts'
import { Network, PrismaClient, User } from '@prisma/client'
import { Queue } from 'bullmq'
import Web3 from 'web3'
import WebSocket from 'ws'

import { WebSocketMessage } from './types'
import { DydxWorker } from './worker'

const NETWORK_ID = { [Network.MAINNET]: 1, [Network.TESTNET]: 5 }

export class Dydx {
    public readonly web3: Web3
    private readonly networkId: number
    public readonly client: DydxClient
    public readonly ws: WebSocket
    public readonly queue: Queue
    public worker?: DydxWorker
    public user?: User
    public apiKey?: ApiKeyCredentials

    constructor(
        public readonly network: Network,
        public readonly httpHost: string,
        public readonly wsHost: string,
        public readonly httpProvider: string,
        public readonly prisma: PrismaClient
    ) {
        this.web3 = new Web3(new Web3.providers.HttpProvider(httpProvider))
        this.networkId = NETWORK_ID[network]

        this.client = new DydxClient(httpHost, {
            // @ts-ignore
            web3: this.web3,
            networkId: this.networkId,
        })
        this.ws = new WebSocket(wsHost)

        this.queue = new Queue('dydx-ws', {
            connection: {
                host: 'localhost',
                port: 6379,
            },
        })
    }

    public async init() {
        await this.initUser()
        this.initWebSocket()
        this.initWorker()
    }

    private initWorker() {
        if (!this.user) {
            throw new Error('User is not initialized')
        }

        this.worker = new DydxWorker(this.prisma, this.user)
    }

    private async initUser() {
        const users = await this.prisma.user.findMany({
            where: {
                network: this.network,
            },
        })

        let selectedUser = await select<User | string>({
            message: 'Select user',
            choices: [
                ...users.map((user) => ({ name: user.username, value: user })),
                new Separator(),
                { name: 'Create new user', value: 'create new user' },
            ],
        })

        if (typeof selectedUser === 'string') {
            const { user, apiKey } = await this.createUser()
            this.user = user
            this.apiKey = apiKey
        } else {
            this.user = selectedUser

            const apiKey = await this.prisma.apiKey.findFirstOrThrow({
                where: {
                    userId: this.user.id,
                },
            })
            this.apiKey = apiKey

            this.client.apiKeyCredentials = this.apiKey
            // @ts-ignore
            this.client.starkPrivateKey = keyPair.privateKey
        }
    }

    private async createUser() {
        const username = await input({ message: 'Enter username' })
        const privateKey = await password({ message: 'Enter your private key' })

        const userExists = await this.prisma.user.findFirst({
            where: { privateKey, network: this.network },
        })
        if (userExists) {
            throw new Error(`user already exists: ${userExists.username}`)
        }

        this.web3.eth.accounts.wallet.add(privateKey)
        const address = this.web3.eth.accounts.wallet[0].address

        const { exists } = await this.client.public.doesUserExistWithAddress(
            address
        )

        const keyPair = await this.client.onboarding.deriveStarkKey(address)

        if (!exists) {
            await this.client.onboarding.createUser(
                {
                    starkKey: keyPair.publicKey,
                    starkKeyYCoordinate: keyPair.publicKeyYCoordinate,
                },
                address
            )
        }

        const apiKey =
            await this.client.onboarding.recoverDefaultApiCredentials(address)

        this.client.apiKeyCredentials = apiKey
        // @ts-ignore
        this.client.starkPrivateKey = keyPair.privateKey

        const {
            account: { positionId },
        } = await this.client.private.getAccount(address)

        const user = await this.prisma.user.create({
            data: {
                username,
                address,
                privateKey,
                starkPrivateKey: keyPair.privateKey,
                positionId,
                network: this.network,
                apiKey: {
                    create: {
                        key: apiKey.key,
                        secret: apiKey.secret,
                        passphrase: apiKey.passphrase,
                    },
                },
            },
        })

        return { user, apiKey }
    }

    private initWebSocket() {
        if (!this.apiKey) {
            throw new Error('apiKey is not defined')
        }

        const timestamp = new Date().toISOString()
        const signature = this.client.private.sign({
            requestPath: '/ws/accounts',
            method: RequestMethod.GET,
            isoTimestamp: timestamp,
        })

        const accountsMessage = {
            type: 'subscribe',
            channel: 'v3_accounts',
            accountNumber: '0',
            apiKey: this.apiKey.key,
            signature,
            timestamp,
            passphrase: this.apiKey.passphrase,
        }

        const marketsMessage = {
            type: 'subscribe',
            channel: 'v3_markets',
        }

        this.ws.on('open', () => {
            this.ws.send(JSON.stringify(marketsMessage))
            this.ws.send(JSON.stringify(accountsMessage))
            for (const market of Object.values(Market)) {
                const orderbookMessage = {
                    type: 'subscribe',
                    channel: 'v3_orderbook',
                    id: market,
                    includeOffsets: true,
                }
                this.ws.send(JSON.stringify(orderbookMessage))
            }
        })

        this.ws.on('message', async (rawData) => {
            const data = JSON.parse(rawData.toString()) as WebSocketMessage

            if (data.channel) {
                this.queue.add(data.channel, data, {
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
}
