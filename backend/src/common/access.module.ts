import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from '../students/student-profile.entity';
import { AccessService } from './access.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([StudentProfile])],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
