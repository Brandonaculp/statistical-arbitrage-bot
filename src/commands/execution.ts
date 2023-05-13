import type { Arguments, CommandBuilder } from 'yargs'
import type { BaseOptions } from './types'
import { initWSClient } from '../utils/dydxClient'

interface Options extends BaseOptions {
    ticker1: string
    ticker2: string
    positiveTicker: number
    tradeableCapital: number
    stopLoss: number
    triggerThresh: number
    limitOrder: boolean
    'tradeable-capital': number
    'stop-loss': number
    'trigger-thresh': number
    'limit-order': boolean
    'positive-ticker': number
}

export const command = 'execution'
export const desc = 'Run the execution'

export const builder: CommandBuilder<Options, Options> = (yargs) =>
    yargs
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
    const { wsHost } = argv

    const ws = initWSClient(wsHost)
}
