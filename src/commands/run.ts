import type { Arguments, CommandBuilder } from 'yargs'
import { Worker } from 'bullmq'
import { WebSocketMessage, initClient, initWSClient } from '../utils/dydxClient'
import {
    handleMarketsWSMessage,
    handleOrderbookWSMessage,
} from '../execution/calculations'
import { getMarkets, getMarketsPrices } from '../strategy/market'
import { getCointegratedPairs } from '../strategy/cointegration'
import { CandleResolution } from '@dydxprotocol/v3-client'

interface Options {
    ticker1: string
    ticker2: string
    positiveTicker: number
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
    'http-host': string
    'ws-host': string
    'candles-limit': number
    'zscore-window': number
    'time-frame': CandleResolution
    'tradeable-capital': number
    'stop-loss': number
    'trigger-thresh': number
    'limit-order': boolean
    'positive-ticker': number
}

export const command = 'run'
export const desc = 'Run DyDx bot'

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
        .option('ticker1', {
            type: 'string',
            description: 'Ticker 1',
            demandOption: true,
        })
        .option('ticker2', {
            type: 'string',
            description: 'Ticker 2',
            demandOption: true,
        })
        .option('positive-ticker', {
            type: 'number',
            description: 'Positive Ticker',
            choices: [1, 2],
            default: 1,
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
    const { wsHost, httpHost, timeFrame, candlesLimit } = argv

    initClient(httpHost)

    console.log('[+]Fetching markets')
    await getMarkets()

    console.log('[+]Fetching markets prices')
    await getMarketsPrices(timeFrame, candlesLimit)

    console.log('[+]Finding cointegrated pairs')
    await getCointegratedPairs()

    const ws = initWSClient(wsHost)

    const worker = new Worker<
        WebSocketMessage,
        any,
        WebSocketMessage['channel']
    >(
        'dydx-ws',
        async (job) => {
            switch (job.name) {
                case 'v3_markets':
                    await handleMarketsWSMessage(job.data)
                    break
                case 'v3_orderbook':
                    await handleOrderbookWSMessage(job.data)
                    break
            }
        },
        { autorun: false }
    )

    await worker.run()
}
