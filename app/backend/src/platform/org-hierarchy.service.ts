import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService, TenantTransaction } from '../common/prisma/prisma.service';
import { getTenant, getTenantId } from '../common/tenant/tenant-context';
import { CreateBranchDto } from './dto/hierarchy/create-branch.dto';
import { CreateDepartmentDto } from './dto/hierarchy/create-department.dto';
import { CreateMembershipDto } from './dto/hierarchy/create-membership.dto';

@Injectable()
export class OrgHierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const tenantId = getTenantId();
    return this.prisma.forCurrentTenant(async (tx) => {
      await this.ensureHierarchy(tx, tenantId, getTenant().userId ?? null);

      const clinic = await tx.organizationClinic.findFirst({
        where: { tenantId },
        include: {
          organization: { select: { id: true, name: true, code: true, status: true } },
        },
      });
      if (!clinic) throw new NotFoundException('Clinic mapping not found');

      const [branches, departments, memberships] = await Promise.all([
        tx.branch.findMany({ where: { tenantId, clinicId: clinic.id, isActive: true }, orderBy: { createdAt: 'asc' } }),
        tx.department.findMany({ where: { tenantId, isActive: true }, orderBy: { createdAt: 'asc' } }),
        tx.userMembership.findMany({
          where: { tenantId, isActive: true },
          include: {
            user: { select: { id: true, email: true, name: true } },
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
          orderBy: [{ isDefaultContext: 'desc' }, { createdAt: 'asc' }],
        }),
      ]);

      return {
        organization: clinic.organization,
        clinic: {
          id: clinic.id,
          tenantId: clinic.tenantId,
          name: clinic.displayName,
        },
        branches,
        departments,
        memberships,
      };
    });
  }

  async createBranch(dto: CreateBranchDto) {
    const tenantId = getTenantId();
    return this.prisma.forCurrentTenant(async (tx) => {
      const { clinic, organization } = await this.ensureHierarchy(tx, tenantId, getTenant().userId ?? null);
      const code = dto.code.trim().toUpperCase();

      const exists = await tx.branch.findUnique({
        where: { tenantId_code: { tenantId, code } },
        select: { id: true },
      });
      if (exists) {
        throw new BadRequestException(`Branch code ${code} already exists for this clinic`);
      }

      return tx.branch.create({
        data: {
          tenantId,
          organizationId: organization.id,
          clinicId: clinic.id,
          name: dto.name.trim(),
          code,
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim() || null,
          city: dto.city?.trim() || null,
        },
      });
    });
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const tenantId = getTenantId();
    return this.prisma.forCurrentTenant(async (tx) => {
      const branch = await tx.branch.findFirst({ where: { id: dto.branchId, tenantId } });
      if (!branch) throw new NotFoundException('Branch not found');

      const name = dto.name.trim();
      const exists = await tx.department.findFirst({ where: { branchId: branch.id, name } });
      if (exists) {
        throw new BadRequestException(`Department ${name} already exists in this branch`);
      }

      return tx.department.create({
        data: {
          tenantId,
          branchId: branch.id,
          name,
          specialtyKey: dto.specialtyKey?.trim() || null,
        },
      });
    });
  }

  async createMembership(dto: CreateMembershipDto) {
    const tenantId = getTenantId();
    return this.prisma.forCurrentTenant(async (tx) => {
      const { clinic, organization } = await this.ensureHierarchy(tx, tenantId, getTenant().userId ?? null);

      const user = await tx.user.findFirst({ where: { id: dto.userId, tenantId } });
      if (!user) throw new NotFoundException('User not found in this clinic');

      let branchId: string | null = null;
      let departmentId: string | null = null;

      if (dto.branchId) {
        const b = await tx.branch.findFirst({ where: { id: dto.branchId, tenantId } });
        if (!b) throw new NotFoundException('Branch not found');
        branchId = b.id;
      }

      if (dto.departmentId) {
        const d = await tx.department.findFirst({ where: { id: dto.departmentId, tenantId } });
        if (!d) throw new NotFoundException('Department not found');
        departmentId = d.id;
        if (branchId && d.branchId !== branchId) {
          throw new BadRequestException('Department does not belong to the selected branch');
        }
        if (!branchId) branchId = d.branchId;
      }

      const existing = await tx.userMembership.findFirst({
        where: {
          userId: user.id,
          tenantId,
          clinicId: clinic.id,
          branchId,
          departmentId,
          isActive: true,
        },
      });
      if (existing) {
        return existing;
      }

      if (dto.isDefaultContext) {
        await tx.userMembership.updateMany({
          where: { userId: user.id, tenantId, isActive: true },
          data: { isDefaultContext: false },
        });
      }

      return tx.userMembership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          tenantId,
          clinicId: clinic.id,
          branchId,
          departmentId,
          role: dto.role,
          isDefaultContext: dto.isDefaultContext ?? false,
        },
      });
    });
  }

  async ensureHierarchy(tx: TenantTransaction, tenantId: string, actorUserId: string | null) {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    let clinic = await tx.organizationClinic.findFirst({ where: { tenantId } });
    let organization;

    if (clinic) {
      organization = await tx.organization.findUnique({ where: { id: clinic.organizationId } });
      if (!organization) throw new NotFoundException('Organization not found for clinic');
    } else {
      const base = `org-${tenant.slug}`.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `org-${tenant.id.slice(0, 8)}`;
      let code = base;
      let n = 1;
      while (await tx.organization.findUnique({ where: { code } })) {
        n += 1;
        code = `${base}-${n}`;
      }

      organization = await tx.organization.create({
        data: {
          code,
          name: `${tenant.name} Organization`,
          ownerUserId: actorUserId,
          status: 'ACTIVE',
        },
      });

      clinic = await tx.organizationClinic.create({
        data: {
          organizationId: organization.id,
          tenantId,
          displayName: tenant.name,
          isPrimary: true,
        },
      });
    }

    const facility = await tx.facility.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    const hasBranch = await tx.branch.findFirst({ where: { tenantId, clinicId: clinic.id, isActive: true } });
    if (!hasBranch) {
      await tx.branch.create({
        data: {
          tenantId,
          organizationId: organization.id,
          clinicId: clinic.id,
          name: facility?.name || `${tenant.name} Main Branch`,
          code: 'MAIN',
          city: facility?.city || null,
        },
      });
    }

    return { organization, clinic };
  }
}
