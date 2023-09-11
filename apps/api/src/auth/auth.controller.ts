import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SigninDto, SignupDto } from './dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    const { access_token } = await this.authService.signup(dto);
    return { access_token };
  }

  @HttpCode(HttpStatus.OK)
  @Post('signin')
  async signin(@Body() dto: SigninDto) {
    const { access_token } = await this.authService.signin(dto);
    return { access_token };
  }
}
