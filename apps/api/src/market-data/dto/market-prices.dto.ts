import { Market } from '@dydxprotocol/v3-client';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { MarektsPricesDto } from './markets-prices.dto';

export class MarektPricesDto extends MarektsPricesDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(Object.values(Market))
  market: Market;
}
