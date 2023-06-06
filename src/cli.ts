#!/usr/bin/env node
import { CandleResolution } from '@dydxprotocol/v3-client'
import { input, select } from '@inquirer/prompts'
import { Network } from '@prisma/client'
import * as dotenv from 'dotenv'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { StatBot } from './stat-bot'

dotenv.config()

yargs(hideBin(process.argv))
    .command(
        'start',
        'start the bot',
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
                .positional('tradeable-capital', {
                    type: 'number',
                    description: 'Tradeable Capital',
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
                tradeableCapital,
                stopLoss,
                triggerThresh,
                limitOrder,
            } = argv

            const network = await select<Network>({
                message: 'Select network',
                choices: [
                    {
                        name: 'Mainnet',
                        value: Network.MAINNET,
                    },
                    {
                        name: 'Testnet',
                        value: Network.TESTNET,
                    },
                ],
            })

            const httpHost = await input({
                message: 'Dydx HTTP API',
                default:
                    network === Network.MAINNET
                        ? 'https://api.dydx.exchange'
                        : 'https://api.stage.dydx.exchange',
            })

            const wsHost = await input({
                message: 'Dydx Websocket API',
                default:
                    network === Network.MAINNET
                        ? 'wss://api.dydx.exchange/v3/ws'
                        : 'wss://api.stage.dydx.exchange/v3/ws',
            })

            const provider = await input({
                message: 'Ethereum HTTP provider',
                default:
                    network === Network.MAINNET
                        ? 'https://ethereum.publicnode.com'
                        : 'https://ethereum-goerli.publicnode.com',
            })

            const bot = new StatBot({
                fresh,
                connection: {
                    httpHost,
                    wsHost,
                    network,
                    provider,
                },
                trading: {
                    timeFrame,
                    candlesLimit,
                    zscoreWindow,
                    tradeableCapital,
                    stopLoss,
                    triggerThresh,
                    limitOrder,
                },
            })

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
