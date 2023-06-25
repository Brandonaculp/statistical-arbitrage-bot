import { type ApiKeyCredentials, DydxClient } from '@dydxprotocol/v3-client'
import { Separator, input, password, select } from '@inquirer/prompts'
import { type Account, Network, type PrismaClient } from '@prisma/client'
import { Queue } from 'bullmq'
import Web3 from 'web3'

import { DydxWorker } from '../dydx-worker/dydx-worker'
import { DydxWebSocket } from '../dydx-ws/dydx-ws'
import { type ConnectionConfig } from '../types'

const NETWORK_ID = { [Network.MAINNET]: 1, [Network.TESTNET]: 5 }

export class Dydx {
    public readonly web3: Web3
    private readonly networkId: number
    public readonly client: DydxClient
    public queue?: Queue
    public ws?: DydxWebSocket
    public worker?: DydxWorker
    public account?: Account
    public apiKey?: ApiKeyCredentials

    constructor(
        public readonly config: ConnectionConfig,
        public readonly prisma: PrismaClient
    ) {
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.provider))
        this.networkId = NETWORK_ID[config.network]

        this.client = new DydxClient(config.httpHost, {
            // @ts-expect-error: web3 definition is wrong
            web3: this.web3,
            networkId: this.networkId,
        })
    }

    public async init(): Promise<void> {
        await this.initAccount()
        this.initWebSocket()
    }

    private initWebSocket(): void {
        if (this.apiKey == null) {
            throw new Error('apiKey is not defined')
        }

        this.initQueue()
        this.initWorker()

        if (this.queue === undefined) {
            throw new Error('queue is not initialized')
        }

        this.ws = new DydxWebSocket(
            this.config.wsHost,
            this.client,
            this.apiKey,
            this.queue
        )
    }

    private initQueue(): void {
        this.queue = new Queue('dydx-ws', {
            connection: {
                host: 'localhost',
                port: 6379,
            },
        })
    }

    private initWorker(): void {
        if (this.account == null) {
            throw new Error('account is not initialized')
        }

        this.worker = new DydxWorker(this.prisma, this.account)
    }

    private async initAccount(): Promise<void> {
        const accounts = await this.prisma.account.findMany({
            where: {
                network: this.config.network,
            },
        })

        const selectedAccount = await select<Account | string>({
            message: 'Select account',
            choices: [
                ...accounts.map((account) => ({
                    name: account.name,
                    value: account,
                })),
                new Separator(),
                { name: 'Create new account', value: 'create new account' },
            ],
        })

        if (typeof selectedAccount === 'string') {
            const { account, apiKey } = await this.createAccount()
            this.account = account
            this.apiKey = apiKey
        } else {
            this.account = selectedAccount

            const apiKey = await this.prisma.apiKey.findFirstOrThrow({
                where: {
                    accountId: this.account.id,
                },
            })
            this.apiKey = apiKey

            this.client.apiKeyCredentials = this.apiKey

            // @ts-expect-error: starkPrivateKey is readonly
            this.client.starkPrivateKey = this.account.starkPrivateKey
        }
    }

    private async createAccount(): Promise<{
        account: Account
        apiKey: ApiKeyCredentials
    }> {
        const name = await input({ message: 'Enter name' })
        const privateKey = await password({ message: 'Enter your private key' })

        const accountExists = await this.prisma.account.findFirst({
            where: { privateKey, network: this.config.network },
        })
        if (accountExists != null) {
            throw new Error(`account already exists: ${accountExists.name}`)
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
        // @ts-expect-error: starkPrivateKey is readonly
        this.client.starkPrivateKey = keyPair.privateKey

        const {
            account: { positionId, id },
        } = await this.client.private.getAccount(address)

        const account = await this.prisma.account.create({
            data: {
                id,
                name,
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

        return { account, apiKey }
    }
}
