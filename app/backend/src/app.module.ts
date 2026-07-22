import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { PatientsModule } from './modules/patients/patients.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { HealthModule } from './modules/health/health.module';
import { PacksModule } from './packs/packs.module';
import { PlatformModule } from './platform/platform.module';
import { InstrumentsModule } from './instruments/instruments.module';
import { ObservationsModule } from './observations/observations.module';
import { GrowthModule } from './growth/growth.module';
import { DosingModule } from './dosing/dosing.module';
import { StorageModule } from './storage/storage.module';
import { MediaModule } from './media/media.module';
import { CatalogModule } from './catalog/catalog.module';
import { EmrModule } from './emr/emr.module';
import { BillingModule } from './billing/billing.module';
import { ImmunizationModule } from './immunization/immunization.module';
import { DentalModule } from './dental/dental.module';
import { LabModule } from './lab/lab.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { ReportsModule } from './reports/reports.module';
import { HrModule } from './hr/hr.module';
import { IpdModule } from './ipd/ipd.module';
import { CrmModule } from './crm/crm.module';
import { ImagingModule } from './imaging/imaging.module';
import { ObstetricsModule } from './obstetrics/obstetrics.module';
import { OphthalmologyModule } from './ophthalmology/ophthalmology.module';
import { RehabModule } from './rehab/rehab.module';
import { DermatologyModule } from './dermatology/dermatology.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { TenantMiddleware } from './common/tenant/tenant.middleware';

/**
 * Root module.
 *
 * Wires configuration, Prisma, and the feature modules together, and applies
 * TenantMiddleware to every route so each request runs inside an
 * AsyncLocalStorage tenant context (see common/tenant).
 */
@Module({
  imports: [
    // Global config — configuration.ts provides the typed shape.
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    AuthModule,
    EntitlementsModule,
    PatientsModule,
    AppointmentsModule,
    HealthModule,
    PacksModule,
    PlatformModule,
    InstrumentsModule,
    ObservationsModule,
    GrowthModule,
    DosingModule,
    StorageModule,
    MediaModule,
    CatalogModule,
    EmrModule,
    BillingModule,
    ImmunizationModule,
    DentalModule,
    LabModule,
    PharmacyModule,
    ReportsModule,
    HrModule,
    IpdModule,
    CrmModule,
    ImagingModule,
    ObstetricsModule,
    OphthalmologyModule,
    RehabModule,
    DermatologyModule,
    IntegrationsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Establish tenant context for all incoming requests.
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}