#!/usr/bin/env node
import { CandleResolution, Market } from '@dydxprotocol/v3-client'
import dayjs from 'dayjs'
import * as dotenv from 'dotenv'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { StatBot } from './stat-bot'

dotenv.config()

yargs(hideBin(process.argv))
    .command(
        'backtest',
        'run backtesting',
        (yargs) => {
            return yargs
                .positional('candles-limit', {
                    type: 'number',
                    description: 'The number of candles to fetch(max: 100)',
                    default: 100,

                    coerce: (value) => {
                        if (value <= 100) return value
                        throw new Error(
                            'The candles limit must be less than or equal to 100'
                        )
                    },
                })
                .positional('zscore-window', {
                    type: 'number',
                    description: 'Zscore window',
                    default: 21,
                })
                .positional('time-frame', {
                    type: 'string',
                    description: 'Time frame',
                    choices: [
                        CandleResolution.ONE_HOUR,
                        CandleResolution.ONE_DAY,
                    ],
                    default: CandleResolution.ONE_HOUR,
                })
                .positional('from', {
                    type: 'number',
                    description: 'Number of time-frames ago for the start date',
                    default: 100,
                    coerce: (from) => {
                        if (from <= 0) {
                            throw new Error(
                                'The start date must be greater than 0'
                            )
                        }
                        return from
                    },
                })
                .positional('to', {
                    type: 'number',
                    description: 'Number of time-frames ago for the end date',
                    default: 0,
                    coerce: (to) => {
                        if (to < 0) {
                            throw new Error(
                                'The start date must be greater than or equal to 0'
                            )
                        }
                        return to
                    },
                })
                .positional('tradable-capital', {
                    type: 'number',
                    description: 'Tradable Capital',
                    default: 100,
                })
                .positional('stop-loss', {
                    type: 'number',
                    description: 'Stop Loss percentage',
                    default: 0.15,
                })
                .positional('trigger-thresh', {
                    type: 'number',
                    description: 'Trigger threshold',
                    default: 1.1,
                })
                .check((args) => {
                    if (args.from < args.to) {
                        console.log('hererere')
                        throw new Error(
                            'The start date must be before the end date'
                        )
                    }

                    return true
                })
        },
        async (argv) => {
            const {
                timeFrame,
                from,
                to,
                candlesLimit,
                zscoreWindow,
                tradableCapital,
                stopLoss,
                triggerThresh,
            } = argv

            // Create a new StatBot instance
            const bot = await StatBot.newStatBot({
                timeFrame,
                candlesLimit,
                zscoreWindow,
                tradableCapital,
                stopLoss,
                triggerThresh,
                from,
                to,
            })

            await bot.initDocker()
            await bot.initPrisma()
            await bot.initMarkets()

            await bot.backtest()
        }
    )
    .command(
        'trade',
        'run trading bot',
        (yargs) => {
            return yargs
                .positional('fresh', {
                    type: 'boolean',
                    description: 'Fresh start',
                    default: false,
                })
                .positional('candles-limit', {
                    type: 'number',
                    description: 'The number of candles to fetch(max: 100)',
                    default: 100,

                    coerce: (value) => {
                        if (value <= 100) return value
                        throw new Error(
                            'The candles limit must be less than or equal to 100'
                        )
                    },
                })
                .positional('zscore-window', {
                    type: 'number',
                    description: 'Zscore window',
                    default: 21,
                })
                .positional('time-frame', {
                    type: 'string',
                    description: 'Time frame',
                    choices: Object.values(CandleResolution),
                    default: CandleResolution.ONE_HOUR,
                })
                .positional('tradable-capital', {
                    type: 'number',
                    description: 'Tradable Capital',
                    default: 100,
                })
                .positional('stop-loss', {
                    type: 'number',
                    description: 'Stop Loss percentage',
                    default: 0.15,
                })
                .positional('trigger-thresh', {
                    type: 'number',
                    description: 'Trigger threshold',
                    default: 1.1,
                })
                .positional('limit-order', {
                    type: 'boolean',
                    description: 'Limit order',
                    default: true,
                })
        },
        async (argv) => {
            const {
                fresh,
                timeFrame,
                candlesLimit,
                zscoreWindow,
                tradableCapital,
                stopLoss,
                triggerThresh,
                limitOrder,
            } = argv

            const bot = await StatBot.newStatBot(
                {
                    timeFrame,
                    candlesLimit,
                    zscoreWindow,
                    tradableCapital,
                    stopLoss,
                    triggerThresh,
                    limitOrder,
                },
                fresh
            )

            // Graceful shutdown on SIGINT
            process.on('SIGINT', async () => {
                try {
                    await bot.docker.stopAll()
                } catch (error) {
                    console.error(error)
                }

                process.exit()
            })

            await bot.init()

            await bot.start()
        }
    )
    .option('verbose', {
        alias: 'v',
        description: 'Enable verbose logging',
        type: 'boolean',
        global: true,
    })
    .strict()
    .alias({ h: 'help' }).argv
