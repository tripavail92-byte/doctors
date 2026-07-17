import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { getTenant } from '../common/tenant/tenant-context';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { RunPayrollDto } from './dto/run-payroll.dto';

/**
 * HR / Payroll: staff records and monthly payroll runs. A run computes one
 * payslip per active employee (net = base + allowances − deductions) and is
 * unique per period.
 */
@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  addEmployee(dto: CreateEmployeeDto) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.employee.create({
        data: {
          tenantId: tenantId!,
          name: dto.name,
          designation: dto.designation,
          baseSalaryPkr: dto.baseSalaryPkr,
          allowancesPkr: dto.allowancesPkr ?? 0,
          phone: dto.phone ?? null,
          cnic: dto.cnic ?? null,
          joinDate: dto.joinDate ? new Date(dto.joinDate) : null,
        },
      }),
    );
  }

  listEmployees() {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.employee.findMany({ orderBy: { name: 'asc' } }),
    );
  }

  runPayroll(dto: RunPayrollDto) {
    const { tenantId, userId } = getTenant();
    const deductions = dto.deductions ?? [];
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.payrollRun.findUnique({
        where: { tenantId_period: { tenantId: tenantId!, period: dto.period } },
      });
      if (existing) throw new BadRequestException(`Payroll already run for ${dto.period}`);

      const employees = await tx.employee.findMany({ where: { status: 'ACTIVE' } });
      const empById = new Map(employees.map((e) => [e.id, e]));

      const dedByEmp = new Map<string, number>();
      for (const d of deductions) {
        const emp = empById.get(d.employeeId);
        if (!emp) {
          throw new BadRequestException('Deduction references an unknown or inactive employee');
        }
        const cur = (dedByEmp.get(d.employeeId) ?? 0) + d.amountPkr;
        if (cur > emp.baseSalaryPkr + emp.allowancesPkr) {
          throw new BadRequestException(`Deductions for ${emp.name} exceed gross pay`);
        }
        dedByEmp.set(d.employeeId, cur);
      }

      const slips = employees.map((e) => {
        const ded = dedByEmp.get(e.id) ?? 0;
        return {
          employeeId: e.id,
          baseSalaryPkr: e.baseSalaryPkr,
          allowancesPkr: e.allowancesPkr,
          deductionsPkr: ded,
          netPkr: e.baseSalaryPkr + e.allowancesPkr - ded,
        };
      });
      const totalNetPkr = slips.reduce((s, x) => s + x.netPkr, 0);

      const run = await tx.payrollRun.create({
        data: { tenantId: tenantId!, period: dto.period, totalNetPkr, createdById: userId ?? null },
      });
      if (slips.length) {
        await tx.payslip.createMany({
          data: slips.map((s) => ({ tenantId: tenantId!, runId: run.id, ...s })),
        });
      }
      return reload(tx, run.id);
    });
  }

  async finalize(runId: string) {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { id: runId } });
      if (!run) throw new NotFoundException(`Payroll run ${runId} not found`);
      if (run.status === PayrollStatus.FINALIZED) {
        throw new BadRequestException('Payroll run is already finalized');
      }
      await tx.payrollRun.update({ where: { id: runId }, data: { status: PayrollStatus.FINALIZED } });
      return reload(tx, runId);
    });
  }

  listRuns() {
    const { tenantId } = getTenant();
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.payrollRun.findMany({ orderBy: { period: 'desc' } }),
    );
  }

  async getRun(id: string) {
    const { tenantId } = getTenant();
    const run = await this.prisma.forTenant(tenantId, (tx) => reload(tx, id));
    if (!run) throw new NotFoundException(`Payroll run ${id} not found`);
    return run;
  }
}

function reload(tx: Prisma.TransactionClient, id: string) {
  return tx.payrollRun.findUnique({
    where: { id },
    include: { payslips: { include: { employee: { select: { name: true, designation: true } } } } },
  });
}
