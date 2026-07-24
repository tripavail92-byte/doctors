import { PrismaClient, UserRole } from '@prisma/client';

const seedUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: seedUrl } } });

function slugCode(base: string): string {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

async function uniqueOrgCode(preferred: string): Promise<string> {
  let code = preferred;
  let n = 1;
  while (await prisma.organization.findUnique({ where: { code } })) {
    n += 1;
    code = `${preferred}-${n}`;
  }
  return code;
}

async function main() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });

  for (const tenant of tenants) {
    const defaultOwner = await prisma.user.findFirst({
      where: { tenantId: tenant.id, role: UserRole.OWNER, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });

    let clinic = await prisma.organizationClinic.findFirst({ where: { tenantId: tenant.id } });
    let organization;

    if (clinic) {
      organization = await prisma.organization.findUnique({ where: { id: clinic.organizationId } });
      if (!organization) {
        throw new Error(`Clinic ${clinic.id} references missing organization ${clinic.organizationId}`);
      }
    } else {
      const preferred = slugCode(`org-${tenant.slug || tenant.name || tenant.id.slice(0, 8)}`) || `org-${tenant.id.slice(0, 8)}`;
      const code = await uniqueOrgCode(preferred);
      organization = await prisma.organization.create({
        data: {
          code,
          name: `${tenant.name} Organization`,
          ownerUserId: defaultOwner?.id ?? null,
          status: 'ACTIVE',
        },
      });
      clinic = await prisma.organizationClinic.create({
        data: {
          organizationId: organization.id,
          tenantId: tenant.id,
          displayName: tenant.name,
          isPrimary: true,
        },
      });
    }

    const facility = await prisma.facility.findFirst({ where: { tenantId: tenant.id }, orderBy: { createdAt: 'asc' } });
    let branch = await prisma.branch.findUnique({ where: { tenantId_code: { tenantId: tenant.id, code: 'MAIN' } } });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          tenantId: tenant.id,
          organizationId: organization.id,
          clinicId: clinic.id,
          name: facility?.name || `${tenant.name} Main Branch`,
          code: 'MAIN',
          city: facility?.city || null,
        },
      });
    }

    const users = await prisma.user.findMany({ where: { tenantId: tenant.id, isPlatformAdmin: false } });
    for (const u of users) {
      const existing = await prisma.userMembership.findFirst({
        where: {
          userId: u.id,
          tenantId: tenant.id,
          clinicId: clinic.id,
          branchId: branch.id,
          role: u.role,
          isActive: true,
        },
      });
      if (!existing) {
        await prisma.userMembership.create({
          data: {
            userId: u.id,
            organizationId: organization.id,
            tenantId: tenant.id,
            clinicId: clinic.id,
            branchId: branch.id,
            role: u.role,
            isDefaultContext: u.role === UserRole.OWNER,
            isActive: true,
          },
        });
      }

      const defaultMembership = await prisma.userMembership.findFirst({
        where: { userId: u.id, tenantId: tenant.id, isActive: true },
        orderBy: [{ isDefaultContext: 'desc' }, { createdAt: 'asc' }],
      });
      if (!defaultMembership) continue;

      await prisma.userContextPreference.upsert({
        where: { userId: u.id },
        update: {
          lastOrganizationId: defaultMembership.organizationId,
          lastClinicId: defaultMembership.clinicId,
          lastBranchId: defaultMembership.branchId,
          lastDepartmentId: defaultMembership.departmentId,
        },
        create: {
          userId: u.id,
          lastOrganizationId: defaultMembership.organizationId,
          lastClinicId: defaultMembership.clinicId,
          lastBranchId: defaultMembership.branchId,
          lastDepartmentId: defaultMembership.departmentId,
        },
      });
    }

    // eslint-disable-next-line no-console
    console.log(`Backfilled Phase A hierarchy for tenant ${tenant.slug} (${tenant.id})`);
  }

  // eslint-disable-next-line no-console
  console.log(`Phase A backfill complete for ${tenants.length} tenants.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
