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

    const pairs = await prisma.pair.findMany({
        select: {
            id: true,
            marketA: {
                select: {
                    id: true,
                    candles: {
                        select: { close: true },
                        orderBy: { createdAt: 'asc' },
                    },
                },
            },
            marketB: {
                select: {
                    id: true,
                    candles: {
                        select: { close: true },
                        orderBy: { createdAt: 'asc' },
                    },
                },
            },
        },
    })

    await prisma.coint.deleteMany()

    for (const pair of pairs) {
        const series1 = pair.marketA.candles.map((candle) => candle.close)
        const series2 = pair.marketB.candles.map((candle) => candle.close)

        if (series1.length !== series2.length) continue

        const cointResult = await calculateCoint(series1, series2)

        await prisma.coint.create({
            data: {
                pairId: pair.id,
                ...cointResult,
            },
        })
    }
}
