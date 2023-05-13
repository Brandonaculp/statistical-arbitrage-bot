import {
    MarketsResponseObject,
    OrderbookChannelDataResponseObject,
    OrderbookSubscribeResponseObject,
} from './types'
import { prisma } from '../utils/prismaClient'
import { WebSocketMessage } from '../utils/dydxClient'

export async function handleMarketsWSMessage(data: WebSocketMessage) {
    const markets = (
        data.type === 'subscribed' ? data.contents.markets : data.contents
    ) as MarketsResponseObject

    for (const [name, marketData] of Object.entries(markets)) {
        if (marketData.indexPrice) {
            const indexPrice = parseFloat(marketData.indexPrice)

            await prisma.market.update({
                where: {
                    name,
                },
                data: {
                    indexPrice,
                },
            })
        }
    }
}

export async function handleOrderbookWSMessage(data: WebSocketMessage) {
    const market = await prisma.market.findFirst({ where: { name: data.id } })
    if (!market) return

    if (data.type === 'subscribed') {
        await prisma.order.deleteMany({ where: { marketId: market.id } })

        const orders = data.contents as OrderbookSubscribeResponseObject

        for (const bid of orders.bids) {
            await prisma.order.create({
                data: {
                    price: parseFloat(bid.price),
                    size: parseFloat(bid.size),
                    offset: parseFloat(bid.offset),
                    side: 'bid',
                    marketId: market.id,
                },
            })
        }

        for (const ask of orders.asks) {
            await prisma.order.create({
                data: {
                    price: parseFloat(ask.price),
                    size: parseFloat(ask.size),
                    offset: parseInt(ask.offset),
                    side: 'ask',
                    marketId: market.id,
                },
            })
        }

        return
    }

    const orders = data.contents as OrderbookChannelDataResponseObject
    const offset = parseInt(orders.offset)

    for (const bid of orders.bids) {
        const price = parseFloat(bid[0])
        const size = parseFloat(bid[1])

        const order = await prisma.order.findFirst({
            where: { price, side: 'bid' },
        })
        if (!order) {
            await prisma.order.create({
                data: {
                    price,
                    size,
                    offset,
                    side: 'bid',
                    marketId: market.id,
                },
            })
            continue
        }

        if (offset > order.offset) {
            if (size === 0) {
                await prisma.order.delete({ where: { id: order.id } })
            } else {
                await prisma.order.update({
                    where: { id: order.id },
                    data: { size, offset },
                })
            }
        }
    }

    for (const ask of orders.asks) {
        const price = parseFloat(ask[0])
        const size = parseFloat(ask[1])

        const order = await prisma.order.findFirst({
            where: { price, side: 'ask' },
        })
        if (!order) {
            await prisma.order.create({
                data: {
                    price,
                    size,
                    offset,
                    side: 'ask',
                    marketId: market.id,
                },
            })
            continue
        }

        if (offset > order.offset) {
            if (size === 0) {
                await prisma.order.delete({ where: { id: order.id } })
            } else {
                await prisma.order.update({
                    where: { id: order.id },
                    data: { size, offset },
                })
            }
        }
    }
}
