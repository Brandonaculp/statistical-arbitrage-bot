import { OmitType } from '@nestjs/swagger';
import { SignupDto } from './signup.dto';

export class SigninDto extends OmitType(SignupDto, ['privateKey'] as const) {}
