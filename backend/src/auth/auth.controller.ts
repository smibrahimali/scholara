import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { DemoLoginDto } from './dto/demo-login.dto';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { JwtPayload } from './jwt-payload';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('demo-login')
  @ApiOkResponse({ description: 'Returns JWT and user profile for demo login' })
  demoLogin(@Body() dto: DemoLoginDto) {
    return this.authService.demoLogin(dto);
  }

  @Get('demo-accounts')
  getDemoAccounts() {
    return this.authService.getDemoAccounts();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: unknown) {
    return user as JwtPayload;
  }
}
