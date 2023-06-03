import { CandleResolution } from '@dydxprotocol/v3-client'
import { Network, PrismaClient } from '@prisma/client'

import { Docker } from './docker/docker'
import { Dydx } from './dydx/dydx'
import { MarketData } from './market-data/market-data'
import { Statistics } from './statistics/statistics'
import { Trade } from './trade/trade'

export class Bot {
    public readonly docker: Docker
    public readonly prisma: PrismaClient
    public readonly dydx: Dydx
    public readonly statistics: Statistics
    public readonly marketData: MarketData
    public readonly trade: Trade

    constructor(
        network: Network,
        httpHost: string,
        wsHost: string,
        httpProvider: string,
        timeFrame: CandleResolution,
        candlesLimit: number,
        zscoreWindow: number
    ) {
        this.docker = new Docker()
        this.prisma = new PrismaClient()
        this.dydx = new Dydx(
            network,
            httpHost,
            wsHost,
            httpProvider,
            this.prisma
        )
        this.statistics = new Statistics(zscoreWindow)

        this.marketData = new MarketData(
            this.dydx,
            this.prisma,
            this.statistics,
            timeFrame,
            candlesLimit
        )

        this.trade = new Trade(this.dydx, this.prisma)
    }
}
