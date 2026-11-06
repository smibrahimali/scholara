import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { UserRole } from '../common/enums';
import { DemoLoginDto } from './dto/demo-login.dto';
import { JwtPayload } from './jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async demoLogin(dto: DemoLoginDto) {
    const user = await this.usersRepo.findOne({
      where: { email: dto.email.toLowerCase() },
      relations: {
        studentProfile: true,
        guardianProfile: true,
        consultantProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid demo credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid demo credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      studentProfileId: user.studentProfile?.id,
      guardianProfileId: user.guardianProfile?.id,
      consultantProfileId: user.consultantProfile?.id,
      linkedStudentId: user.guardianProfile?.linkedStudentId,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        studentProfileId: payload.studentProfileId ?? null,
        guardianProfileId: payload.guardianProfileId ?? null,
        consultantProfileId: payload.consultantProfileId ?? null,
        linkedStudentId: payload.linkedStudentId ?? null,
      },
    };
  }

  async getDemoAccounts() {
    const users = await this.usersRepo.find({
      order: { role: 'ASC', email: 'ASC' },
    });

    return users.map((user) => ({
      email: user.email,
      role: user.role as UserRole,
      fullName: user.fullName,
      passwordHint: 'demo123',
    }));
  }
}
