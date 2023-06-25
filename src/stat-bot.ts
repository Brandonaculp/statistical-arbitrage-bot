import { input, select } from '@inquirer/prompts'
import { Network, PrismaClient } from '@prisma/client'
import { exec } from 'child_process'
import ora from 'ora'
import { promisify } from 'util'

import { Backtest } from './backtest/backtest'
import { Chart } from './chart/chart'
import { Docker } from './docker/docker'
import { Dydx } from './dydx/dydx'
import { MarketData } from './market-data/market-data'
import { Statistics } from './statistics/statistics'
import { Trade } from './trade/trade'
import {
    type BacktestConfig,
    type StatBotConfig,
    type TradingConfig,
} from './types'

export class StatBot {
    public readonly docker: Docker
    public readonly prisma: PrismaClient
    public readonly statistics: Statistics
    public readonly marketData: MarketData
    public readonly dydx: Dydx
    public readonly trade: Trade
    public readonly backtest: Backtest
    public readonly chart: Chart

    constructor(public readonly config: StatBotConfig) {
        this.docker = new Docker()
        this.prisma = new PrismaClient()
        this.dydx = new Dydx(config.connection, this.prisma)
        this.statistics = new Statistics(config.trading)

        this.marketData = new MarketData(
            this.dydx,
            this.prisma,
            this.statistics,
            config.trading,
            config.backtest
        )

        this.chart = new Chart(this.prisma)

        this.trade = new Trade(
            this.dydx,
            this.prisma,
            this.statistics,
            config.trading
        )

        this.backtest = new Backtest(
            this.marketData,
            this.prisma,
            this.chart,
            this.config.trading,
            this.config.backtest
        )
    }

    private async init(isBacktest: boolean): Promise<void> {
        await this.initDocker()
        await this.initPrisma()
        await this.initMarkets()
        if (!isBacktest) await this.initDydx()
    }

    private async initDocker(): Promise<void> {
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

    private async initPrisma(): Promise<void> {
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

    private async initMarkets(): Promise<void> {
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

    private async initDydx(): Promise<void> {
        const spinner = ora()

        try {
            await this.dydx.init()
            spinner.succeed('Dydx client initialized')
        } catch (error) {
            spinner.fail('Failed to initialize dydx client')
            throw error
        }
    }

    static async newStatBot(
        tradingConfig: TradingConfig,
        backtestConfig?: BacktestConfig,
        fresh = false
    ): Promise<StatBot> {
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
            backtest: backtestConfig,
            fresh,
        })

        await bot.init(!(backtestConfig == null))

        return bot
    }
}
