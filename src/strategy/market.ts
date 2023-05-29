import { CandleResolution, Market } from '@dydxprotocol/v3-client'

import { client } from '../utils/dydxClient'
import { prisma } from '../utils/prismaClient'

export async function getMarkets() {
    const { markets } = await client.public.getMarkets()
    await prisma.market.deleteMany()

    await prisma.market.createMany({
        data: Object.values(markets).map((market) => ({
            name: market.market,
            indexPrice: parseFloat(market.indexPrice),
        })),
    })
}

export async function getPairs() {
    const markets = await prisma.market.findMany()
    await prisma.pair.deleteMany()

    const included: Record<string, boolean> = {}

    for (const marketA of markets) {
        for (const marketB of markets) {
            if (marketA.id === marketB.id) continue

            const unique = [marketA.id, marketB.id].sort().join('-')
            if (included[unique]) continue
            included[unique] = true

            await prisma.pair.create({
                data: {
                    marketAId: marketA.id,
                    marketBId: marketB.id,
                },
            })
        }
    }
}

export async function getMarketsPrices(
    timeFrame: CandleResolution,
    candlesLimit: number
) {
    const markets = await prisma.market.findMany()

    for (const market of markets) {
        const { candles } = await client.public.getCandles({
            market: market.name as Market,
            resolution: timeFrame,
            limit: candlesLimit,
        })

        if (candles.length === candlesLimit) {
            await prisma.candle.deleteMany({ where: { marketId: market.id } })

            await prisma.candle.createMany({
                data: candles.map((candle) => ({
                    close: parseFloat(candle.close),
                    marketId: market.id,
                })),
            })
        }
    }
}
