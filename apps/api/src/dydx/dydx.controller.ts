import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('dydx')
export class DydxController {}
