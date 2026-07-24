import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrgHierarchyService } from './org-hierarchy.service';
import { CreateBranchDto } from './dto/hierarchy/create-branch.dto';
import { CreateDepartmentDto } from './dto/hierarchy/create-department.dto';
import { CreateMembershipDto } from './dto/hierarchy/create-membership.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
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
