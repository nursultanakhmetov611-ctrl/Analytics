export type DepartmentCode =
  | 'management'
  | 'production'
  | 'finance'
  | 'procurement'
  | 'legal'
  | 'hr'
  | 'logistics'
  | 'audit';

export type PositionCode =
  | 'CEO'
  | 'CHIEF_ENGINEER'
  | 'PRODUCTION_DIRECTOR'
  | 'LEAD_TECHNOLOGIST'
  | 'SHIFT_MASTER'
  | 'BRANCH_DIRECTOR'
  | 'FINANCIAL_DIRECTOR'
  | 'CHIEF_ACCOUNTANT'
  | 'PROCUREMENT_HEAD'
  | 'LEGAL_COUNSEL'
  | 'HR_DIRECTOR'
  | 'LOGISTICS_DISPATCHER';

export type PermissionCode =
  | 'VIEW_EXECUTIVE_DASHBOARD'
  | 'VIEW_HOLDING_PRODUCTION'
  | 'VIEW_BRANCH_PRODUCTION'
  | 'EDIT_DAILY_SHIFT'
  | 'MANAGE_REFERENCES'
  | 'VIEW_AUDIT_LOGS'
  | 'EXPORT_REPORTS'
  | 'AI_ANALYST_ACCESS'
  | 'MODULE_ACCESS_EXECUTIVE'
  | 'MODULE_ACCESS_PRODUCTION'
  | 'MODULE_ACCESS_FINANCE'
  | 'MODULE_ACCESS_LEGAL'
  | 'MODULE_ACCESS_HR'
  | 'MODULE_ACCESS_PROCUREMENT'
  | 'MODULE_ACCESS_LOGISTICS';

export type DataScope = 'HOLDING_ALL' | 'CENTRAL_APPARATUS' | 'BRANCH_ISOLATED';

export interface PlatformUserAccount {
  username: string;
  password: string;
  displayName: string;
  department: DepartmentCode;
  departmentName: string;
  position: string;
  branchCode: string; // 'ALL' | 'AVRD' | 'KVRD' | 'BVRD' | 'UVRD'
  role: 'headquarters' | 'branch';
  dataScope: DataScope;
  permissions: PermissionCode[];
  availableModules: string[];
}

export interface PlatformUserSession {
  username: string;
  displayName: string;
  department: DepartmentCode;
  departmentName: string;
  position: string;
  branchCode: string;
  role: 'headquarters' | 'branch';
  dataScope: DataScope;
  permissions: PermissionCode[];
  availableModules: string[];
  // Backwards compatibility with ArsAuthSession
  depot_code: string;
  display_name: string;
}

export interface PlatformModuleDefinition {
  id: string;
  code: DepartmentCode | 'executive';
  title: string;
  shortName: string;
  departmentName: string;
  description: string;
  iconName: string;
  status: 'active' | 'roadmap';
  requiredPermission?: PermissionCode;
  badge?: string;
  roadmapQuarter?: string;
  roadmapSummary?: string;
}
