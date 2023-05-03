import type { Arguments, CommandBuilder } from 'yargs'
import { CandleResolution } from '@dydxprotocol/v3-client'
import { access, readFile, writeFile } from 'fs/promises'
import type { BaseOptions } from './types'
import { initClient } from '../utils/dydxClient'
import { getMarkets, getMarketsPrices } from '../strategy/market'
import { getCointegratedPairs } from '../strategy/cointegration'
import { MarketsPrices } from '../strategy/types'

interface Options extends BaseOptions {
    'api-url': string
    'candles-limit': number
    'zscore-window': number
    'time-frame': CandleResolution
    apiUrl: string
    candlesLimit: number
    zscoreWindow: number
    timeFrame: CandleResolution
}

export const command = 'start'
export const desc = 'Start the bot'

export const builder: CommandBuilder<Options, Options> = (yargs) =>
    yargs
        .option('api-url', {
            type: 'string',
            description: 'The dy/dx api url',
            demandOption: true,
        })
        .option('candles-limit', {
            type: 'number',
            description: 'The number of candles to fetch',
            default: 100,
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
        })
        .option('time-frame', {
            type: 'string',
            description: 'Time frame',
            choices: Object.values(CandleResolution),
            default: CandleResolution.ONE_HOUR,
        })

export const handler = async (argv: Arguments<Options>) => {
    const { apiUrl, timeFrame, candlesLimit, zscoreWindow } = argv

    initClient(apiUrl)

    const pricesFile = 'marketPrices.json'
    let prices: MarketsPrices

    try {
        await access(pricesFile)
        prices = JSON.parse((await readFile(pricesFile)).toString())
    } catch {
        console.log('[+]Fetching markets')
        const markets = await getMarkets()
        console.log('[+]Fetching markets prices')
        prices = await getMarketsPrices(markets, timeFrame, candlesLimit)
        await writeFile('marketPrices.json', JSON.stringify(prices), 'utf-8')
    }
    console.log('[+]Finding cointegrated pairs')
    const cointPairs = await getCointegratedPairs(prices)
}
