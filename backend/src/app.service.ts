import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      name: 'Scholara API',
      status: 'ok',
      auth: 'POST /api/auth/demo-login',
    };
  }
}
