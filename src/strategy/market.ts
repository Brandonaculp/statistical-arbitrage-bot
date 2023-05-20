import { CandleResolution, Market } from '@dydxprotocol/v3-client'
import { client } from '../utils/dydxClient'
import { prisma } from '../utils/prismaClient'
import { MarketStatus } from '@prisma/client'

export async function getMarkets() {
    const { markets } = await client.public.getMarkets()

    for (const [market, marketInfo] of Object.entries(markets)) {
        await prisma.market.upsert({
            where: {
                name: market,
            },
            update: {
                status: marketInfo.status as MarketStatus,
            },
            create: {
                name: market,
                status: marketInfo.status as MarketStatus,
            },
        })
    }
}

export async function getMarketsPrices(
    timeFrame: CandleResolution,
    candlesLimit: number
) {
    const markets = await prisma.market.findMany({
        where: { status: 'ONLINE' },
    })

    for (const market of markets) {
        const { candles } = await client.public.getCandles({
            market: market.name as Market,
            resolution: timeFrame,
            limit: candlesLimit,
        })

        if (candles.length === candlesLimit) {
            await prisma.candle.deleteMany({ where: { marketId: market.id } })

            await prisma.candle.createMany({
                data: [
                    ...candles.map((candle) => ({
                        close: parseFloat(candle.close),
                        marketId: market.id,
                    })),
                ],
            })
        }
    }
}
