import { CandleResolution } from '@dydxprotocol/v3-client'
import { Network, PrismaClient } from '@prisma/client'
import { exec } from 'child_process'
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

    async start() {
        await this.docker.startAll({ fresh: this.config.fresh })
        await this.pushDB()
        await this.marketData.sync()
        await this.dydx.init()
    }

    async pushDB() {
        const execAsync = promisify(exec)
        await execAsync('npx prisma db push --accept-data-loss')
    }
}
