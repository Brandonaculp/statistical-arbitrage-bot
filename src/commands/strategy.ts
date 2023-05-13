import type { Arguments, CommandBuilder } from 'yargs'
import { access, readFile, writeFile } from 'fs/promises'
import type { BaseOptions } from './types'
import { initClient } from '../utils/dydxClient'
import { getMarkets, getMarketsPrices } from '../strategy/market'
import { getCointegratedPairs } from '../strategy/cointegration'
import { MarketsPrices } from '../strategy/types'

interface Options extends BaseOptions {}

export const command = 'strategy'
export const desc = 'Run the strategy'

export const builder: CommandBuilder<Options, Options> = (yargs) => yargs

export const handler = async (argv: Arguments<Options>) => {
    const { httpHost, timeFrame, candlesLimit } = argv

    initClient(httpHost)

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

    console.table(cointPairs)
}
