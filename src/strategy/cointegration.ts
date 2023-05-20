import { CointResult } from './types'
import { axiosInstance } from '../utils/customAxios'
import { prisma } from '../utils/prismaClient'

async function calculateCoint(series1: number[], series2: number[]) {
    const coint = await axiosInstance.post<CointResult>(
        '/calculate_cointegration',
        {
            series1,
            series2,
        }
    )

    return coint.data
}

export async function getCointegratedPairs() {
    const included: Record<string, boolean> = {}

    const markets = await prisma.market.findMany({
        where: { status: 'ONLINE' },
        select: {
            id: true,
            candles: { select: { close: true }, orderBy: { createdAt: 'asc' } },
        },
    })

    await prisma.coint.deleteMany()

    for (const marketA of markets) {
        for (const marketB of markets) {
            if (marketA.id === marketB.id) continue

            const unique = [marketA.id, marketB.id].sort().join('')
            if (included[unique]) continue

            included[unique] = true

            const series1 = marketA.candles.map((candle) => candle.close)
            const series2 = marketB.candles.map((candle) => candle.close)

            const cointResult = await calculateCoint(series1, series2)

            await prisma.coint.create({
                data: {
                    marketAId: marketA.id,
                    marketBId: marketB.id,
                    ...cointResult,
                },
            })
        }
    }
}
