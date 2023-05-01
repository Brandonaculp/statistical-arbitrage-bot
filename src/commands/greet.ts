import type { Arguments, CommandBuilder } from 'yargs'
import type { BaseOptions } from './types'

interface Options extends BaseOptions {
    name: string
    upper?: boolean
}

export const command = 'greet <name>'
export const desc = 'Greet <name> with Hello'

export const builder: CommandBuilder<Options, Options> = (yargs) =>
    yargs
        .option('upper', {
            type: 'boolean',
            description: 'upper case',
        })
        .positional('name', { type: 'string', demandOption: true })

export const handler = (argv: Arguments<Options>) => {
    const { name, upper } = argv
    const greeting = `Hello ${name}!`
    process.stdout.write(upper ? greeting.toUpperCase() : greeting)
    process.exit(0)
}
