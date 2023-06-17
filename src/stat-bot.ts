import { OrderSide } from '@dydxprotocol/v3-client'
import { input, select } from '@inquirer/prompts'
import { Market, Network, PrismaClient } from '@prisma/client'
import { exec } from 'child_process'
import ora from 'ora'
import { promisify } from 'util'

import { Docker } from './docker/docker'
import { Dydx } from './dydx/dydx'
import { MarketData } from './market-data/market-data'
import { Statistics } from './statistics/statistics'
import { Trade } from './trade/trade'
import { BotState, StatBotConfig, TradingConfig } from './types'
import { sleep } from './utils'

export class StatBot {
    public readonly docker: Docker
    public readonly prisma: PrismaClient
    public readonly statistics: Statistics
    public readonly marketData: MarketData
    public readonly dydx: Dydx
    public readonly trade: Trade
    private state: BotState = BotState.ManageNewTrades

    constructor(public readonly config: StatBotConfig) {
        this.docker = new Docker()
        this.prisma = new PrismaClient()
        this.dydx = new Dydx(config.connection, this.prisma)
        this.statistics = new Statistics(config.trading)

        this.marketData = new MarketData(
            this.dydx,
            this.prisma,
            this.statistics,
            config.trading
        )

        this.trade = new Trade(
            this.dydx,
            this.prisma,
            this.statistics,
            config.trading
        )
    }

    async init() {
        await this.initDocker()
        await this.initPrisma()
        await this.initMarkets()
        await this.initDydx()
    }

    async initDocker() {
        const spinner = ora({
            text: 'Starting docker containers',
            spinner: 'point',
            color: 'yellow',
        }).start()

        try {
            await this.docker.startAll({ fresh: this.config.fresh })
            spinner.succeed('Docker containers started')
        } catch (error) {
            spinner.fail('Failed to start cotnainers')
            throw error
        }
    }

    async initPrisma() {
        const spinner = ora({
            text: 'Prisma database push',
            spinner: 'point',
            color: 'yellow',
        }).start()

        try {
            const execAsync = promisify(exec)
            await execAsync('npx prisma db push --accept-data-loss')
            spinner.succeed('Database pushed')
        } catch (error) {
            spinner.fail('Failed to push database')
            throw error
        }
    }

    async initMarkets() {
        const spinner = ora({
            text: 'Update markets',
            spinner: 'point',
            color: 'yellow',
        }).start()

        try {
            await this.marketData.updateMarkets()
            await this.marketData.storePairs()
            spinner.succeed('Markets updated')
        } catch (error) {
            spinner.fail('Failed to update markets')
            throw error
        }
    }

    async initDydx() {
        const spinner = ora()

        try {
            await this.dydx.init()
            spinner.succeed('Dydx client initialized')
        } catch (error) {
            spinner.fail('Failed to initialize dydx client')
            throw error
        }
    }

    async backtest() {
        const { positiveMarket, negativeMarket } = await this.getMarkets()

        await this.marketData.updateMaketPrices(positiveMarket)
    }

    async start() {
        this.state = BotState.ManageNewTrades
        const { positiveMarket, negativeMarket } = await this.getMarkets()

        this.dydx.ws!.subscribeOrderbook(positiveMarket, negativeMarket)
        this.dydx.ws!.subscribeTrades(positiveMarket, negativeMarket)
        while (true) {
            await sleep(3000)
            const positionA = await this.trade.getOpenPosition(positiveMarket)
            const positionB = await this.trade.getOpenPosition(negativeMarket)
            const activeOrdersA = await this.trade.getActiveOrders(
                positiveMarket
            )
            const activeOrdersB = await this.trade.getActiveOrders(
                negativeMarket
            )
            const isManageNewTrades = [
                !!positionA,
                !!positionB,
                activeOrdersA.length > 0,
                activeOrdersB.length > 0,
            ].every((v) => !v)
            if (isManageNewTrades && this.state === BotState.ManageNewTrades) {
                this.state = await this.trade.manageNewTrades(
                    positiveMarket,
                    negativeMarket,
                    OrderSide.BUY,
                    OrderSide.SELL
                )
            }
            if (this.state === BotState.CloseTrades) {
                this.state = await this.trade.closeAllPositions(
                    positiveMarket,
                    negativeMarket
                )
            }
        }
    }

    private async getMarkets() {
        const markets = await this.prisma.market.findMany()
        const positiveMarket = await select<Market>({
            message: 'Select singal positive market',
            choices: markets.map((market) => ({
                name: market.name,
                value: market,
            })),
        })
        const negativeMarket = await select<Market>({
            message: 'Select singal negative market',
            choices: markets
                .filter((market) => market.id !== positiveMarket.id)
                .map((market) => ({
                    name: market.name,
                    value: market,
                })),
        })

        return { positiveMarket, negativeMarket }
    }

    static async newStatBot(tradingConfig: TradingConfig, fresh = false) {
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

        const httpHost = await input({
            message: 'Dydx HTTP API',
            default:
                network === Network.MAINNET
                    ? 'https://api.dydx.exchange'
                    : 'https://api.stage.dydx.exchange',
        })

        const wsHost = await input({
            message: 'Dydx Websocket API',
            default:
                network === Network.MAINNET
                    ? 'wss://api.dydx.exchange/v3/ws'
                    : 'wss://api.stage.dydx.exchange/v3/ws',
        })

        const provider = await input({
            message: 'Ethereum HTTP provider',
            default:
                network === Network.MAINNET
                    ? 'https://ethereum.publicnode.com'
                    : 'https://ethereum-goerli.publicnode.com',
        })

        const bot = new StatBot({
            connection: {
                httpHost,
                wsHost,
                network,
                provider,
            },
            trading: tradingConfig,
            fresh,
        })

        return bot
    }
}
