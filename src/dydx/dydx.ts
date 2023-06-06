import { ApiKeyCredentials, DydxClient, Market } from '@dydxprotocol/v3-client'
import { Separator, input, password, select } from '@inquirer/prompts'
import { Network, PrismaClient, User } from '@prisma/client'
import { Queue } from 'bullmq'
import Web3 from 'web3'

import { DydxWorker } from '../dydx-worker/dydx-worker'
import { DydxWebSocket } from '../dydx-ws/dydx-ws'
import { ConnectionConfig } from '../types'

const NETWORK_ID = { [Network.MAINNET]: 1, [Network.TESTNET]: 5 }

export class Dydx {
    public readonly web3: Web3
    private readonly networkId: number
    public readonly client: DydxClient
    public readonly queue: Queue
    public ws?: DydxWebSocket
    public worker?: DydxWorker
    public user?: User
    public apiKey?: ApiKeyCredentials

    constructor(
        public readonly config: ConnectionConfig,
        public readonly prisma: PrismaClient
    ) {
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.provider))
        this.networkId = NETWORK_ID[config.network]

        this.client = new DydxClient(config.httpHost, {
            // @ts-ignore
            web3: this.web3,
            networkId: this.networkId,
        })

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

    private initWebSocket() {
        if (!this.apiKey) {
            throw new Error('apiKey is not defined')
        }

        this.ws = new DydxWebSocket(
            this.config.wsHost,
            this.client,
            this.apiKey,
            this.queue
        )
    }

    private initWorker() {
        if (!this.user) {
            throw new Error('user is not initialized')
        }

        this.worker = new DydxWorker(this.prisma, this.user)
    }

    private async initUser() {
        const users = await this.prisma.user.findMany({
            where: {
                network: this.config.network,
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
            this.client.starkPrivateKey = this.user.starkPrivateKey
        }
    }

    private async createUser() {
        const username = await input({ message: 'Enter username' })
        const privateKey = await password({ message: 'Enter your private key' })

        const userExists = await this.prisma.user.findFirst({
            where: { privateKey, network: this.config.network },
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
                network: this.config.network,
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
}
