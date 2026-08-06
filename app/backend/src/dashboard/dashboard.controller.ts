import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

/**
 * Clinic-ops dashboard (reference #4). One controller hosts every widget's
 * endpoint at its own path; guards are declared PER METHOD because each widget
 * has its own entitlement + role boundary (financial vs operational vs
 * clinical). RolesGuard and EntitlementGuard both read handler-level metadata
 * (getAllAndOverride([handler, class])), so method-level decorators apply.
 *
 * A widget the caller isn't entitled to (e.g. reporting.core on a lower
 * edition) returns 403; the frontend renders that widget's error state without
 * taking the rest of the dashboard down.
 */
@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@Controller()
export class DashboardController {
  constructor(private readonly dash: DashboardService) {}

  // --- financial (reporting.core) ------------------------------------------

  @Get('dashboard/today')
  @RequiresEntitlement('reporting.core')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE)
  today() {
    return this.dash.today();
  }

  @Get('reports/revenue-split')
  @RequiresEntitlement('reporting.core')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE)
  revenueSplit(@Query('period') period?: string) {
    return this.dash.revenueSplit(period);
  }

  @Get('reports/doctor-earnings')
  @RequiresEntitlement('reporting.core')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCE)
  doctorEarnings(@Query('period') period?: string) {
    return this.dash.doctorEarnings(period);
  }

  // --- operational: appointments (appointments.core) -----------------------

  @Get('appointments/today')
  @RequiresEntitlement('appointments.core')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.RECEPTION, UserRole.DOCTOR, UserRole.TREATMENT)
  appointmentsToday() {
    return this.dash.appointmentsToday();
  }

  @Get('sessions/in-progress')
  @RequiresEntitlement('appointments.core')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.RECEPTION, UserRole.DOCTOR, UserRole.TREATMENT)
  sessionsInProgress() {
    return this.dash.sessionsInProgress();
  }

  @Get('patients/queue')
  @RequiresEntitlement('appointments.core')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.RECEPTION, UserRole.DOCTOR, UserRole.TREATMENT)
  patientQueue() {
    return this.dash.patientQueue();
  }

  // --- clinical: encounters (emr.core) -------------------------------------

  @Get('encounters/recent')
  @RequiresEntitlement('emr.core')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DOCTOR, UserRole.TREATMENT, UserRole.RECEPTION)
  recentEncounters(@Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 5;
    return this.dash.recentEncounters(Number.isFinite(n) ? n : 5);
  }

  // --- pharmacy stock (pharmacy.core) --------------------------------------

  @Get('pharmacy/stock/alerts')
  @RequiresEntitlement('pharmacy.core')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.INVENTORY, UserRole.RECEPTION, UserRole.DOCTOR)
  stockAlerts() {
    return this.dash.stockAlerts();
  }

  // --- CRM lead sources (crm.core) -----------------------------------------

  @Get('crm/lead-sources')
  @RequiresEntitlement('crm.core')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.SALES, UserRole.RECEPTION)
  leadSources(@Query('period') period?: string) {
    return this.dash.leadSources(period);
  }
}
