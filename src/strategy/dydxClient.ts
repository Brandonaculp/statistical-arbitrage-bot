import { DydxClient } from '@dydxprotocol/v3-client'

export let client: DydxClient

export function initClient(host: string) {
    client = new DydxClient(host)
}
