#!/usr/bin/env node
import { CandleResolution } from '@dydxprotocol/v3-client'
import * as dotenv from 'dotenv'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { StatBot } from './stat-bot'

dotenv.config()

yargs(hideBin(process.argv))
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
