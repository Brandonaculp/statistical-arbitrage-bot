import {
    type AccountResponseObject,
    type OrderResponseObject,
    OrderStatus,
    type PositionResponseObject,
    PositionStatus,
    type Trade,
} from '@dydxprotocol/v3-client'
import {
    type Account,
    type ActiveOrderSide,
    type ActiveOrderStatus,
    type ActiveOrderType,
    type PositionSide,
    type PrismaClient,
    type TradeSide,
} from '@prisma/client'
import { Worker } from 'bullmq'

import { type WebSocketMessage } from '../dydx-ws/types'
import {
    type MarketsResponseObject,
    type OrderbookChannelDataResponseObject,
    type OrderbookSubscribeResponseObject,
} from './types'

export class DydxWorker {
    private readonly worker: Worker<
        WebSocketMessage,
        any,
        WebSocketMessage['channel']
    >

    constructor(
        public readonly prisma: PrismaClient,
        public readonly account: Account
    ) {
        this.worker = new Worker<
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
                        await this.handleAccountsWSMessage(job.data)
                        break
                    case 'v3_trades':
                        await this.handleTradesWSMessage(job.data)
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

    private async handleMarketsWSMessage(
        data: WebSocketMessage
    ): Promise<void> {
        const markets = (
            data.type === 'subscribed' ? data.contents.markets : data.contents
        ) as MarketsResponseObject

        for (const [name, marketData] of Object.entries(markets)) {
            if (marketData.indexPrice !== undefined) {
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

    private async handleOrderbookWSMessage(
        data: WebSocketMessage
    ): Promise<void> {
        const market = await this.prisma.market.findFirst({
            where: { name: data.id },
        })
        if (market == null) return

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
            if (order == null) {
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
            if (order == null) {
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

    private async handleAccountsWSMessage(
        data: WebSocketMessage
    ): Promise<void> {
        if (data.type === 'subscribed') {
            await this.prisma.position.deleteMany({
                where: { accountId: this.account.id },
            })

            await this.prisma.activeOrder.deleteMany({
                where: {
                    accountId: this.account.id,
                },
            })

            const { account, orders } = data.contents as {
                orders: OrderResponseObject[]
                account: AccountResponseObject
            }

            for (const order of orders) {
                if (
                    order.status === OrderStatus.CANCELED ||
                    order.status === OrderStatus.FILLED
                ) {
                    continue
                }

                const market = await this.prisma.market.findFirstOrThrow({
                    where: { name: order.market },
                })

                await this.prisma.activeOrder.create({
                    data: {
                        id: order.id,
                        size: parseFloat(order.size),
                        remainingSize: parseFloat(order.remainingSize),
                        price: parseFloat(order.price),
                        side: order.side as ActiveOrderSide,
                        status: order.status as ActiveOrderStatus,
                        type: order.type as ActiveOrderType,
                        accountId: this.account.id,
                        marketId: market.id,
                    },
                })
            }

            await this.prisma.account.update({
                where: {
                    id: account.id,
                },
                data: {
                    quoteBalance: parseFloat(account.quoteBalance),
                },
            })

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
                        accountId: this.account.id,
                        marketId: market.id,
                    },
                })
            }

            return
        }

        const { positions, orders, accounts } = data.contents as {
            positions?: PositionResponseObject[]
            orders?: OrderResponseObject[]
            accounts?: AccountResponseObject[]
        }

        if (accounts != null) {
            await this.prisma.account.update({
                where: {
                    id: accounts[0].id,
                },
                data: {
                    quoteBalance: parseFloat(accounts[0].quoteBalance),
                },
            })
        }

        if (orders != null) {
            for (const order of orders) {
                if (
                    order.status === OrderStatus.CANCELED ||
                    order.status === OrderStatus.FILLED
                ) {
                    await this.prisma.activeOrder.delete({
                        where: { id: order.id },
                    })

                    continue
                }

                const market = await this.prisma.market.findFirstOrThrow({
                    where: { name: order.market },
                })

                await this.prisma.activeOrder.upsert({
                    where: {
                        id: order.id,
                    },
                    create: {
                        id: order.id,
                        size: parseFloat(order.size),
                        remainingSize: parseFloat(order.remainingSize),
                        price: parseFloat(order.price),
                        side: order.side as ActiveOrderSide,
                        status: order.status as ActiveOrderStatus,
                        type: order.type as ActiveOrderType,
                        accountId: this.account.id,
                        marketId: market.id,
                    },
                    update: {
                        remainingSize: parseFloat(order.remainingSize),
                        status: order.status as ActiveOrderStatus,
                    },
                })
            }
        }

        if (positions != null) {
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
                            accountId: this.account.id,
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

    private async handleTradesWSMessage(data: WebSocketMessage): Promise<void> {
        const MAX_SIZE = 100

        const { trades } = data.contents as {
            trades: Trade[]
        }

        const market = await this.prisma.market.findFirst({
            where: { name: data.id },
        })

        if (market == null) return

        if (data.type === 'subscribed') {
            await this.prisma.trade.deleteMany({
                where: {
                    marketId: market.id,
                },
            })
        }

        await this.prisma.trade.createMany({
            data: trades.slice(0, MAX_SIZE).map((trade) => ({
                side: trade.side as TradeSide,
                size: parseFloat(trade.size),
                price: parseFloat(trade.price),
                marketId: market.id,
                createdAt: trade.createdAt,
            })),
        })

        const rowCount = await this.prisma.trade.count({
            where: { marketId: market.id },
        })

        if (rowCount > MAX_SIZE) {
            const rowsToDelete = rowCount - MAX_SIZE

            const oldRows = await this.prisma.trade.findMany({
                take: rowsToDelete,
                where: {
                    marketId: market.id,
                },
                orderBy: {
                    createdAt: 'asc',
                },
                select: {
                    id: true,
                },
            })

            await this.prisma.trade.deleteMany({
                where: {
                    id: {
                        in: oldRows.map((row) => row.id),
                    },
                },
            })
        }
    }
}
