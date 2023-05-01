#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

yargs(hideBin(process.argv))
    .option('verbose', {
        alias: 'v',
        description: 'Enable verbose logging',
        type: 'boolean',
    })
    .global('verbose')
    .commandDir('commands', { exclude: /types\.js/ })
    .strict()
    .alias({ h: 'help' }).argv
