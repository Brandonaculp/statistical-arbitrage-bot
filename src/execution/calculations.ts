import {
    AccountResponseObject,
    PositionResponseObject,
    PositionStatus,
} from '@dydxprotocol/v3-client'
import { Order, PositionSide } from '@prisma/client'

import { WebSocketMessage } from '../utils/dydxClient'
import { prisma } from '../utils/prismaClient'
import {
    MarketsResponseObject,
    OrderbookChannelDataResponseObject,
    OrderbookSubscribeResponseObject,
} from './types'

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
            const price = parseFloat(bid.price)
            const size = parseFloat(bid.size)
            const offset = parseFloat(bid.offset)

            if (size > 0) {
                await prisma.order.create({
                    data: {
                        price,
                        size,
                        offset,
                        side: 'BID',
                        marketId: market.id,
                    },
                })
            }
        }

        for (const ask of orders.asks) {
            const price = parseFloat(ask.price)
            const size = parseFloat(ask.size)
            const offset = parseFloat(ask.offset)

            if (size > 0) {
                await prisma.order.create({
                    data: {
                        price,
                        size,
                        offset,
                        side: 'ASK',
                        marketId: market.id,
                    },
                })
            }
        }

        return
    }

    const orders = data.contents as OrderbookChannelDataResponseObject
    const offset = parseInt(orders.offset)

    for (const bid of orders.bids) {
        const price = parseFloat(bid[0])
        const size = parseFloat(bid[1])

        const order = await prisma.order.findFirst({
            where: { price, side: 'BID', marketId: market.id },
        })
        if (!order) {
            await prisma.order.create({
                data: {
                    price,
                    size,
                    offset,
                    side: 'BID',
                    marketId: market.id,
                },
            })
        } else {
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

    for (const ask of orders.asks) {
        const price = parseFloat(ask[0])
        const size = parseFloat(ask[1])

        const order = await prisma.order.findFirst({
            where: { price, side: 'ASK', marketId: market.id },
        })
        if (!order) {
            await prisma.order.create({
                data: {
                    price,
                    size,
                    offset,
                    side: 'ASK',
                    marketId: market.id,
                },
            })
        } else {
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
}

export async function handlePositionsWSMessage(
    data: WebSocketMessage,
    userId: number
) {
    if (data.type === 'subscribed') {
        await prisma.position.deleteMany({ where: { userId } })

        const { account } = data.contents as {
            account: AccountResponseObject
        }

        for (const [marketName, position] of Object.entries(
            account.openPositions
        )) {
            const market = await prisma.market.findFirstOrThrow({
                where: { name: marketName },
            })

            await prisma.position.create({
                data: {
                    size: parseFloat(position.size),
                    side: position.side as PositionSide,
                    userId,
                    marketId: market.id,
                },
            })
        }

        return
    }

    const { positions } = data.contents as {
        positions?: PositionResponseObject[]
    }

    if (!positions) return

    for (const position of positions) {
        const market = await prisma.market.findFirstOrThrow({
            where: {
                name: position.market,
            },
        })

        if (position.status === PositionStatus.CLOSED) {
            await prisma.position.delete({
                where: {
                    marketId: market.id,
                },
            })
        } else {
            const size = parseFloat(position.size)

            await prisma.position.upsert({
                where: {
                    marketId: market.id,
                },
                create: {
                    size,
                    side: position.side as PositionSide,
                    userId,
                    marketId: market.id,
                },
                update: {
                    size,
                },
            })
        }
    }
}

export function getTradeDetails(
    orders: Order[],
    direction: 'long' | 'short',
    capital: number,
    stopLossFailSafe: number
) {
    const bidOrders = orders
        .filter((order) => order.side === 'BID')
        .sort()
        .reverse()
    const askOrders = orders.filter((order) => order.side === 'ASK').sort()

    if (bidOrders.length && askOrders.length) {
        const nearestAsk = askOrders[0]
        const nearestBid = bidOrders[0]

        const midPrice =
            direction === 'long' ? nearestBid.price : nearestAsk.price

        const stopLoss = midPrice * (1 - stopLossFailSafe)
        const quantity = capital / midPrice

        return {
            midPrice,
            stopLoss,
            quantity,
        }
    }

    throw new Error('One or both of the bid and ask orders are empty')
}
