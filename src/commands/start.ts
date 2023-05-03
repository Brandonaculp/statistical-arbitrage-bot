import type { Arguments, CommandBuilder } from 'yargs'
import type { BaseOptions } from './types'
import { CandleResolution } from '@dydxprotocol/v3-client'
import { initClient } from '../strategy/dydxClient'

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

export const handler = (argv: Arguments<Options>) => {
    const { apiUrl } = argv

    // initialize dy/dx client
    initClient(apiUrl)
}
