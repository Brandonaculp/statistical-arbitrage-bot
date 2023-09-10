import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DydxClient } from '@dydxprotocol/v3-client';
import Web3 from 'web3';
import { keyPair, apiKey } from 'temp-config';
import { Config } from 'src/config';

@Injectable()
export class DydxService {
  private readonly clientCache: Map<
    string,
    { client: DydxClient; web3: Web3 }
  > = new Map();

  constructor(private config: ConfigService<Config, true>) {}

  getClient(privateKey: string) {
    if (this.clientCache.has(privateKey)) {
      return this.clientCache.get(privateKey) as {
        client: DydxClient;
        web3: Web3;
      };
    }

    const web3 = new Web3(
      new Web3.providers.HttpProvider(this.config.get('PROVIDER_URL')),
    );
    web3.eth.accounts.wallet.add(privateKey);

    const client = new DydxClient(this.config.get('DYDX_HTTP_HOST'), {
      // @ts-expect-error: web3 version
      web3,
    });
    this.clientCache.set(privateKey, { client, web3 });

    return { client, web3 };
  }

  getClientAddress(privateKey: string) {
    const { web3 } = this.getClient(privateKey);
    return web3.eth.accounts.wallet[0].address;
  }

  async getOrCreateUser(privateKey: string) {
    let accountId: string;
    let created = false;
    const { client } = this.getClient(privateKey);
    const address = this.getClientAddress(privateKey);

    const { exists } = await client.public.doesUserExistWithAddress(address);

    // TODO: eth_signTypedData
    // const keyPair = await client.onboarding.deriveStarkKey(address);

    client.apiKeyCredentials = apiKey;

    if (!exists) {
      const { account } = await client.onboarding.createUser(
        {
          starkKey: keyPair.publicKey,
          starkKeyYCoordinate: keyPair.publicKeyYCoordinate,
        },
        address,
      );
      created = true;
      accountId = account.id;
    } else {
      const { account } = await client.private.getAccount(address);
      accountId = account.id;
    }

    // TODO: eth_signTypedData
    // const apiKey = await client.onboarding.recoverDefaultApiCredentials(
    //   address,
    // );

    return {
      keyPair,
      apiKey,
      created,
      accountId,
    };
  }
}
