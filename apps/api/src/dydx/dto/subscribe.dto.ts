import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class SubscribeDto {
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  markets: string[];
}
