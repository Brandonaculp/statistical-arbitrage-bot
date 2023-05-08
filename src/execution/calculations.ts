import { MarketsResponseObject } from './types'
import { prisma } from '../utils/prismaClient'

export function handleMarketsWSMessage(markets: MarketsResponseObject) {
    for (const [name, marketData] of Object.entries(markets)) {
        if (marketData.indexPrice) {
            const indexPrice = parseFloat(marketData.indexPrice)

            prisma.market.upsert({
                where: {
                    name,
                },
                update: {
                    indexPrice,
                },
                create: {
                    name,
                    indexPrice,
                },
            })
        }
    }
}

export function handleOrderBookWSMessage() {}
