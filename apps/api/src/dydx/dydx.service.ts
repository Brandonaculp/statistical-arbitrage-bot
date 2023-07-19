import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DydxClient } from '@dydxprotocol/v3-client';
import Web3 from 'web3';

@Injectable()
export class DydxService {
  constructor(private config: ConfigService) {}

  async getOrCreateUser(privateKey: string) {
    let created = false;
    const web3 = new Web3(
      new Web3.providers.HttpProvider(
        this.config.get('PROVIDER_URL') as string,
      ),
    );
    const client = new DydxClient(this.config.get('DYDX_HTTP_HOST') as string, {
      // @ts-expect-error: web3 version
      web3: this.web3,
    });
    web3.eth.accounts.wallet.add(privateKey);
    const address = web3.eth.accounts.wallet[0].address;

    const { exists } = await client.public.doesUserExistWithAddress(address);
    const keyPair = await client.onboarding.deriveStarkKey(address);

    if (!exists) {
      await client.onboarding.createUser(
        {
          starkKey: keyPair.publicKey,
          starkKeyYCoordinate: keyPair.publicKeyYCoordinate,
        },
        address,
      );
      created = true;
    }

    const apiKey = await client.onboarding.recoverDefaultApiCredentials(
      address,
    );

    return {
      keyPair,
      apiKey,
      created,
    };
  }
}
