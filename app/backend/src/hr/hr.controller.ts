import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { HrService } from './hr.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { RunPayrollDto } from './dto/run-payroll.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('hr.core')
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE)
@Controller('hr')
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Post('employees')
  addEmployee(@Body() dto: CreateEmployeeDto) {
    return this.hr.addEmployee(dto);
  }

  @Get('employees')
  employees() {
    return this.hr.listEmployees();
  }

  @Patch('employees/:id/status')
  setEmployeeStatus(@Param('id') id: string, @Body() dto: UpdateEmployeeStatusDto) {
    return this.hr.setEmployeeStatus(id, dto.status);
  }

  @Post('payroll/runs')
  runPayroll(@Body() dto: RunPayrollDto) {
    return this.hr.runPayroll(dto);
  }

  @Get('payroll/runs')
  runs() {
    return this.hr.listRuns();
  }

  @Get('payroll/runs/:id')
  run(@Param('id') id: string) {
    return this.hr.getRun(id);
  }

  @Delete('payroll/runs/:id')
  discard(@Param('id') id: string) {
    return this.hr.discardDraft(id);
  }

  @Patch('payroll/runs/:id/finalize')
  finalize(@Param('id') id: string) {
    return this.hr.finalize(id);
  }
}
