import type { Arguments, CommandBuilder } from 'yargs'
import { Worker } from 'bullmq'
import { CandleResolution } from '@dydxprotocol/v3-client'
import { exec } from 'child_process'
import { promisify } from 'util'
import { WebSocketMessage, initClients } from '../utils/dydxClient'
import {
    handleMarketsWSMessage,
    handleOrderbookWSMessage,
} from '../execution/calculations'
import { getMarkets, getMarketsPrices, getPairs } from '../strategy/market'
import { getCointegratedPairs } from '../strategy/cointegration'
import { sleep } from '../utils/sleep'
import { prisma } from '../utils/prismaClient'
import { Docker } from '../utils/docker'

interface Options {
    tradeableCapital: number
    stopLoss: number
    triggerThresh: number
    limitOrder: boolean
    httpHost: string
    wsHost: string
    candlesLimit: number
    zscoreWindow: number
    timeFrame: CandleResolution
    verbose?: boolean
    fresh: boolean
    'http-host': string
    'ws-host': string
    'candles-limit': number
    'zscore-window': number
    'time-frame': CandleResolution
    'tradeable-capital': number
    'stop-loss': number
    'trigger-thresh': number
    'limit-order': boolean
}

export const command = 'start'
export const desc = 'Start the bot'

export const builder: CommandBuilder<Options, Options> = (yargs) =>
    yargs
        .option('http-host', {
            type: 'string',
            description: 'The dy/dx api url',
            demandOption: true,
            global: true,
        })
        .option('ws-host', {
            type: 'string',
            description: 'The dy/dx websocket url',
            demandOption: true,
            global: true,
        })
        .options('fresh', {
            type: 'boolean',
            description: 'Fresh start',
            default: false,
        })
        .option('candles-limit', {
            type: 'number',
            description: 'The number of candles to fetch(max: 100)',
            default: 100,
            global: true,

            coerce: (value) => {
                if (value <= 100) return value
                throw new Error(
                    'The candles limit must be less than or equal to 100'
                )
            },
        })
        .option('zscore-window', {
            type: 'number',
            description: 'Zscore window',
            default: 21,
            global: true,
        })
        .option('time-frame', {
            type: 'string',
            description: 'Time frame',
            choices: Object.values(CandleResolution),
            default: CandleResolution.ONE_HOUR,
            global: true,
        })
        .option('tradeable-capital', {
            type: 'number',
            description: 'Tradeable Capital',
            demandOption: true,
        })
        .option('stop-loss', {
            type: 'number',
            description: 'Stop Loss percentage',
            default: 0.15,
        })
        .option('trigger-thresh', {
            type: 'number',
            description: 'Trigger threshold',
            default: 1.1,
        })
        .option('limit-order', {
            type: 'boolean',
            description: 'Limit order',
            default: true,
        })

export const handler = async (argv: Arguments<Options>) => {
    const {
        wsHost,
        httpHost,
        timeFrame,
        candlesLimit,
        stopLoss,
        tradeableCapital,
        fresh,
    } = argv

    const docker = new Docker()

    await docker.startPostgres({ fresh })
    await docker.startRedis({ fresh })
    await docker.startAPIServer({ fresh })

    const execAsync = promisify(exec)
    await execAsync('npx prisma db push')

    await initClients(httpHost, wsHost)

    console.log('[+]Fetching markets')
    await getMarkets()

    console.log('[+]Storing pairs')
    await getPairs()

    console.log('[+]Fetching markets prices')
    await getMarketsPrices(timeFrame, candlesLimit)

    console.log('[+]Finding cointegrated pairs')
    await getCointegratedPairs()

    const worker = new Worker<
        WebSocketMessage,
        any,
        WebSocketMessage['channel']
    >('dydx-ws', async (job) => {
        switch (job.name) {
            case 'v3_markets':
                await handleMarketsWSMessage(job.data)
                break
            case 'v3_orderbook':
                await handleOrderbookWSMessage(job.data)
                break
        }
    })

    const coint = await prisma.coint.findFirstOrThrow({
        where: {
            cointFlag: true,
        },
        orderBy: {
            zeroCrossing: 'desc',
        },
        select: {
            pair: true,
        },
    })

    while (true) {
        const marketAOrders = await prisma.order.findMany({
            where: { marketId: coint.pair.marketAId },
        })
        const marketBOrders = await prisma.order.findMany({
            where: { marketId: coint.pair.marketBId },
        })

        await sleep(2000)
    }

    await docker.stopAll()
}
