import {
    AccountResponseObject,
    PositionResponseObject,
    PositionStatus,
} from '@dydxprotocol/v3-client'
import { PositionSide, PrismaClient, User } from '@prisma/client'
import { Worker } from 'bullmq'

import {
    MarketsResponseObject,
    OrderbookChannelDataResponseObject,
    OrderbookSubscribeResponseObject,
    WebSocketMessage,
} from './types'

export class DydxWorker {
    constructor(
        public readonly prisma: PrismaClient,
        public readonly user: User
    ) {
        const worker = new Worker<
            WebSocketMessage,
            any,
            WebSocketMessage['channel']
        >(
            'dydx-ws',
            async (job) => {
                switch (job.name) {
                    case 'v3_markets':
                        await this.handleMarketsWSMessage(job.data)
                        break
                    case 'v3_orderbook':
                        await this.handleOrderbookWSMessage(job.data)
                        break
                    case 'v3_accounts':
                        await this.handlePositionsWSMessage(job.data)
                        break
                }
            },
            {
                connection: {
                    host: 'localhost',
                    port: 6379,
                },
            }
        )
    }

    private async handleMarketsWSMessage(data: WebSocketMessage) {
        const markets = (
            data.type === 'subscribed' ? data.contents.markets : data.contents
        ) as MarketsResponseObject

        for (const [name, marketData] of Object.entries(markets)) {
            if (marketData.indexPrice) {
                const indexPrice = parseFloat(marketData.indexPrice)

                await this.prisma.market.update({
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

    private async handleOrderbookWSMessage(data: WebSocketMessage) {
        const market = await this.prisma.market.findFirst({
            where: { name: data.id },
        })
        if (!market) return

        if (data.type === 'subscribed') {
            await this.prisma.order.deleteMany({
                where: { marketId: market.id },
            })

            const orders = data.contents as OrderbookSubscribeResponseObject

            for (const bid of orders.bids) {
                const price = parseFloat(bid.price)
                const size = parseFloat(bid.size)
                const offset = parseFloat(bid.offset)

                if (size > 0) {
                    await this.prisma.order.create({
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
                    await this.prisma.order.create({
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

            const order = await this.prisma.order.findFirst({
                where: { price, side: 'BID', marketId: market.id },
            })
            if (!order) {
                await this.prisma.order.create({
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
                        await this.prisma.order.delete({
                            where: { id: order.id },
                        })
                    } else {
                        await this.prisma.order.update({
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

            const order = await this.prisma.order.findFirst({
                where: { price, side: 'ASK', marketId: market.id },
            })
            if (!order) {
                await this.prisma.order.create({
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
                        await this.prisma.order.delete({
                            where: { id: order.id },
                        })
                    } else {
                        await this.prisma.order.update({
                            where: { id: order.id },
                            data: { size, offset },
                        })
                    }
                }
            }
        }
    }

    private async handlePositionsWSMessage(data: WebSocketMessage) {
        if (data.type === 'subscribed') {
            await this.prisma.position.deleteMany({
                where: { userId: this.user.id },
            })

            const { account } = data.contents as {
                account: AccountResponseObject
            }

            for (const [marketName, position] of Object.entries(
                account.openPositions
            )) {
                const market = await this.prisma.market.findFirstOrThrow({
                    where: { name: marketName },
                })

                await this.prisma.position.create({
                    data: {
                        size: parseFloat(position.size),
                        side: position.side as PositionSide,
                        userId: this.user.id,
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
            const market = await this.prisma.market.findFirstOrThrow({
                where: {
                    name: position.market,
                },
            })

            if (position.status === PositionStatus.CLOSED) {
                await this.prisma.position.delete({
                    where: {
                        marketId: market.id,
                    },
                })
            } else {
                const size = parseFloat(position.size)

                await this.prisma.position.upsert({
                    where: {
                        marketId: market.id,
                    },
                    create: {
                        size,
                        side: position.side as PositionSide,
                        userId: this.user.id,
                        marketId: market.id,
                    },
                    update: {
                        size,
                    },
                })
            }
        }
    }
}
