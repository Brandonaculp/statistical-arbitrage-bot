import { DydxClient, MarketResponseObject } from '@dydxprotocol/v3-client'
import WebSocket from 'ws'
import { prisma } from './prismaClient'

interface MarketsResponseObject {
    [market: string]: Partial<MarketResponseObject>
}

export let client: DydxClient
export let ws: WebSocket

export function initClient(httpHost: string) {
    client = new DydxClient(httpHost)
}

export function initWsClient(wsHost: string) {
    ws = new WebSocket(wsHost)

    const message = {
        type: 'subscribe',
        channel: 'v3_markets',
    }

    ws.on('open', () => {
        ws.send(JSON.stringify(message))
    })

    ws.on('message', (rawData) => {
        const data = JSON.parse(rawData.toString())
        const markets = data['contents'] as MarketsResponseObject

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
    })
}
