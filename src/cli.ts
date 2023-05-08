#!/usr/bin/env node

import { CandleResolution } from '@dydxprotocol/v3-client'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

yargs(hideBin(process.argv))
    .option('verbose', {
        alias: 'v',
        description: 'Enable verbose logging',
        type: 'boolean',
        global: true,
    })
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
    .commandDir('commands', { exclude: /^types\.(js|ts)$/ })
    .strict()
    .alias({ h: 'help' }).argv
