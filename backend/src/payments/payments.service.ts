import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessService } from '../common/access.service';
import { PaymentStatus } from '../common/enums';
import { JwtPayload } from '../auth/jwt-payload';
import { StudentPayment } from './student-payment.entity';

export type PaymentItemDto = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  occurredOn: string;
  payeeLabel: string | null;
  applicationId: string | null;
};

export type PaymentsSummaryDto = {
  currency: string;
  paidTotal: number;
  dueTotal: number;
  grandTotal: number;
  upcoming: PaymentItemDto[];
  history: PaymentItemDto[];
};

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(StudentPayment)
    private readonly paymentsRepo: Repository<StudentPayment>,
    private readonly access: AccessService,
  ) {}

  async listForUser(
    user: JwtPayload,
    requestedStudentId?: string,
  ): Promise<PaymentsSummaryDto> {
    const studentId = await this.access.resolveReadableStudentId(
      user,
      requestedStudentId,
    );

    const rows = await this.paymentsRepo.find({
      where: { studentId },
      order: { occurredOn: 'DESC', createdAt: 'DESC' },
    });

    const items = rows.map((row) => this.toDto(row));
    const currency = items[0]?.currency ?? 'USD';
    const paidTotal = sumAmount(
      items.filter((i) => i.status === PaymentStatus.PAID),
    );
    const dueTotal = sumAmount(
      items.filter((i) => i.status === PaymentStatus.UPCOMING),
    );

    const upcoming = items
      .filter((i) => i.status === PaymentStatus.UPCOMING)
      .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
    const history = items.filter((i) => i.status === PaymentStatus.PAID);

    return {
      currency,
      paidTotal,
      dueTotal,
      grandTotal: roundMoney(paidTotal + dueTotal),
      upcoming,
      history,
    };
  }

  private toDto(row: StudentPayment): PaymentItemDto {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      status: row.status,
      amount: Number(row.amount),
      currency: row.currency,
      occurredOn: row.occurredOn,
      payeeLabel: row.payeeLabel,
      applicationId: row.applicationId,
    };
  }
}

function sumAmount(items: PaymentItemDto[]): number {
  return roundMoney(items.reduce((sum, item) => sum + item.amount, 0));
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
