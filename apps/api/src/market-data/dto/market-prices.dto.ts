import { Market } from '@dydxprotocol/v3-client';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { MarketsPricesDto } from './markets-prices.dto';

export class MarketPricesDto extends MarketsPricesDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(Object.values(Market))
  market: Market;
}
