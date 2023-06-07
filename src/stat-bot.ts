import { PrismaClient } from '@prisma/client'
import { exec } from 'child_process'
import ora from 'ora'
import { promisify } from 'util'

import { Docker } from './docker/docker'
import { Dydx } from './dydx/dydx'
import { MarketData } from './market-data/market-data'
import { Statistics } from './statistics/statistics'
import { Trade } from './trade/trade'
import { StatBotConfig } from './types'

export class StatBot {
    public readonly docker: Docker
    public readonly prisma: PrismaClient
    public readonly statistics: Statistics
    public readonly marketData: MarketData
    public readonly dydx: Dydx
    public readonly trade: Trade

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
        const dockerSpinner = ora({
            text: 'Starting docker containers',
            spinner: 'point',
            color: 'yellow',
        }).start()

        try {
            await this.docker.startAll({ fresh: this.config.fresh })
            dockerSpinner.succeed('Docker containers started')
        } catch (error) {
            dockerSpinner.fail('Failed to start cotnainers')
            throw error
        }

        const dbSpinner = ora({
            text: 'Pushing database',
            spinner: 'point',
            color: 'yellow',
        }).start()

        try {
            await this.pushDB()
            dbSpinner.succeed('Database pushed')
        } catch (error) {
            dbSpinner.fail('Failed to push database')
            throw error
        }

        const marketDataSpinner = ora({
            text: 'Syncing market data',
            spinner: 'point',
            color: 'yellow',
        }).start()

        try {
            await this.marketData.sync()
            marketDataSpinner.succeed('Market data synced')
        } catch (error) {
            marketDataSpinner.fail('Failed to sync market data')
            throw error
        }

        const dydxSpinner = ora()

        try {
            await this.dydx.init()
            dydxSpinner.succeed('Dydx client initialized')
        } catch (error) {
            dydxSpinner.fail('Failed to initialize dydx client')
            throw error
        }
    }

    async start() {
        const { marketA, marketB } =
            await this.marketData.findCointegratedPair()

        console.log({ marketA: marketA.name, marketB: marketB.name })
    }

    private async pushDB() {
        const execAsync = promisify(exec)
        await execAsync('npx prisma db push --accept-data-loss')
    }
}
