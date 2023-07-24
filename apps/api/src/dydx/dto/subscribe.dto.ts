import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

export class SubscribeDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  markets?: string[];
}
