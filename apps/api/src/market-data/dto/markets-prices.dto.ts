import { CandleResolution } from '@dydxprotocol/v3-client';
import { IsIn, IsNotEmpty, IsNumber, IsString, Max } from 'class-validator';

export class MarektsPricesDto {
  @IsNumber()
  @IsNotEmpty()
  @Max(100)
  candleLimit: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(Object.values(CandleResolution))
  candleResolution: CandleResolution;
}
