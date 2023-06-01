#!/usr/bin/env node
import { CandleResolution, OrderSide } from '@dydxprotocol/v3-client'
import { input, select } from '@inquirer/prompts'
import { Network } from '@prisma/client'
import { Worker } from 'bullmq'
import { exec } from 'child_process'
import * as dotenv from 'dotenv'
import ora from 'ora'
import { promisify } from 'util'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { placeMarketCloseOrder } from './execution/closePositions'
import {
    handleMarketsWSMessage,
    handleOrderbookWSMessage,
    handlePositionsWSMessage,
} from './execution/wsMessageHandlers'
import { getCointegratedPairs } from './strategy/cointegration'
import { getMarkets, getMarketsPrices, getPairs } from './strategy/market'
import { Docker } from './utils/docker'
import { WebSocketMessage, client, initClients } from './utils/dydxClient'
import { prisma } from './utils/prismaClient'
import { sleep } from './utils/sleep'

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
                timeFrame,
                candlesLimit,
                fresh,
                stopLoss,
                tradeableCapital,
            } = argv

            const spinner = ora()

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

            const httpProvider = await input({
                message: 'Ethereum HTTP provider',
                default:
                    network === Network.MAINNET
                        ? 'https://ethereum.publicnode.com'
                        : 'https://ethereum-goerli.publicnode.com',
            })

            const docker = new Docker()

            spinner.start('Starting docker containers')
            await docker.startPostgres({ fresh })
            await docker.startRedis({ fresh })
            await docker.startAPIServer({ fresh })
            spinner.succeed('Docker containers started')

            spinner.start('Push the state from Prisma schema to the database')
            const execAsync = promisify(exec)
            await execAsync('npx prisma db push --accept-data-loss')
            spinner.succeed(
                'The state pushed from Prisma schema to the database'
            )

            const { user } = await initClients(
                network,
                httpHost,
                wsHost,
                httpProvider
            )

            spinner.start('Fetching markets')
            await getMarkets()
            spinner.succeed('Markets fetched')

            // spinner.start('Storing pairs')
            // await getPairs()
            // spinner.succeed('Pairs stored')

            // spinner.start('Fetching markets prices')
            // await getMarketsPrices(timeFrame, candlesLimit)
            // spinner.succeed('Markets prices fetched')

            // spinner.start('Finding cointegrated pairs')
            // await getCointegratedPairs()
            // spinner.succeed('Cointegrated pairs found')

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
                        case 'v3_accounts':
                            await handlePositionsWSMessage(job.data, user)
                            break
                    }
                },
                {
                    connection: {
                        host: 'localhost',
                        port: 6379,
                    },
                }
            )

            const market = await prisma.market.findFirstOrThrow({
                where: { name: 'ETH-USD' },
            })

            await placeMarketCloseOrder(user, market, OrderSide.SELL, '1')

            await worker.close()

            // await docker.stopAll()
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
