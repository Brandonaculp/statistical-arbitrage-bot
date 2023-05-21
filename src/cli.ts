#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as dotenv from 'dotenv'

dotenv.config()

yargs(hideBin(process.argv))
    .option('verbose', {
        alias: 'v',
        description: 'Enable verbose logging',
        type: 'boolean',
        global: true,
    })
    .commandDir('commands', { exclude: /^types\.(js|ts)$/ })
    .strict()
    .alias({ h: 'help' }).argv
