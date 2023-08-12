import { Module } from '@nestjs/common';
import { CointService } from './coint.service';

@Module({
  providers: [CointService],
  exports: [CointService],
})
export class CointModule {}
