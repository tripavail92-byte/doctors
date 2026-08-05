import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiresEntitlement } from '../auth/decorators/requires-entitlement.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrgHierarchyService } from './org-hierarchy.service';
import { CreateBranchDto } from './dto/hierarchy/create-branch.dto';
import { CreateDepartmentDto } from './dto/hierarchy/create-department.dto';
import { CreateMembershipDto } from './dto/hierarchy/create-membership.dto';

// Every operational endpoint on this controller either creates or reads
// multi-branch hierarchy. That is a paid feature. Without a gate here, any
// edition — including SOLO — could POST unlimited branches through the org
// hierarchy API. The `summary` route is included in the gate deliberately:
// the whole endpoint exists for the multi-branch UX, and a SOLO tenant with
// no branches to switch between should not see the hierarchy panel at all.
//
// GET /auth/contexts is a SEPARATE endpoint that every tenant retains — it is
// the mechanism that decides whether the clinic switcher renders, and it must
// keep working for single-branch tenants so login still resolves a home.
@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@RequiresEntitlement('multibranch.core')
@Roles(UserRole.OWNER, UserRole.ADMIN)
@Controller('org/hierarchy')
export class OrgHierarchyController {
  constructor(private readonly hierarchy: OrgHierarchyService) {}

  @Get('summary')
  summary() {
    return this.hierarchy.summary();
  }

  @Post('branches')
  createBranch(@Body() dto: CreateBranchDto) {
    return this.hierarchy.createBranch(dto);
  }

  @Post('departments')
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.hierarchy.createDepartment(dto);
  }

  @Post('memberships')
  createMembership(@Body() dto: CreateMembershipDto) {
    return this.hierarchy.createMembership(dto);
  }
}
