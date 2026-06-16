import type { SessionUser } from './session';

export type AppRole = SessionUser['role'];
export type DashboardPath =
  | '/dashboard'
  | '/dashboard/submit'
  | '/dashboard/submissions'
  | '/dashboard/team-submissions'
  | '/dashboard/submissions/new'
  | '/dashboard/finance'
  | '/dashboard/master-data'
  | '/dashboard/notifications'
  | '/dashboard/guide'
  | '/dashboard/settings'
  | '/dashboard/users'
  | '/dashboard/system';

export function getInvoiceIntakePath(): DashboardPath {
  return '/dashboard/submissions/new';
}

export function isEmployeeRole(role: AppRole) {
  return role === 'employee';
}

export function isTeamLeadRole(role: AppRole) {
  return role === 'team_lead';
}

export function isAdminRole(role: AppRole) {
  return role === 'admin';
}

export function canViewSubmissionsPage(role: AppRole) {
  return isEmployeeRole(role) || isTeamLeadRole(role) || isAdminRole(role);
}

export function canViewNotifications(role: AppRole) {
  return isEmployeeRole(role) || isTeamLeadRole(role) || role === 'finance' || isAdminRole(role) || role === 'developer';
}

export function canViewFinanceDashboard(role: AppRole) {
  return role === 'finance' || isAdminRole(role);
}

export function canViewMasterData(role: AppRole) {
  return role === 'finance' || isAdminRole(role) || role === 'developer';
}

export function canManageUsers(role: AppRole) {
  return role === 'finance' || isAdminRole(role) || role === 'developer';
}

export function canViewSystemPage(role: AppRole) {
  return role === 'developer' || isAdminRole(role);
}

export function canViewTeamSubmissions(role: AppRole) {
  return isTeamLeadRole(role);
}

export function canCreateSubmission(role: AppRole) {
  return isEmployeeRole(role) || isTeamLeadRole(role);
}

export function canSubmitInvoice(role: AppRole) {
  return isEmployeeRole(role) || isTeamLeadRole(role);
}

export function canViewInvoiceStatus(role: AppRole) {
  return role === 'finance' || role === 'admin' || role === 'developer';
}

export function canViewFinanceFields(role: AppRole) {
  return canViewFinanceDashboard(role);
}

export function canViewSystemFields(role: AppRole) {
  return canViewSystemPage(role);
}

export function canResubmitSubmission(role: AppRole, row: { intake_status: 'submitted' | 'rejected' | 'accepted' }) {
  return (isEmployeeRole(role) || isTeamLeadRole(role)) && row.intake_status === 'rejected';
}

export function getDefaultDashboardPath(role: AppRole) {
  if (canViewFinanceDashboard(role) && !isAdminRole(role)) return '/dashboard/finance';
  if (canViewSystemPage(role) && !isAdminRole(role)) return '/dashboard/system';
  return '/dashboard';
}

export function canAccessDashboardPath(role: AppRole, pathname: string) {
  if (pathname === '/dashboard') return true;
  if (pathname === '/dashboard/submit') return canSubmitInvoice(role);
  if (pathname === '/dashboard/submissions/new') return canSubmitInvoice(role);
  if (pathname === '/dashboard/submissions') return canViewSubmissionsPage(role);
  if (pathname === '/dashboard/team-submissions') return canViewTeamSubmissions(role);
  if (pathname === '/dashboard/finance') return canViewFinanceDashboard(role);
  if (pathname === '/dashboard/master-data') return canViewMasterData(role);
  if (pathname === '/dashboard/notifications') return canViewNotifications(role);
  if (pathname === '/dashboard/guide') return true;
  if (pathname === '/dashboard/settings') return true;
  if (pathname === '/dashboard/users') return canManageUsers(role);
  if (pathname === '/dashboard/system') return canViewSystemPage(role);
  return false;
}

export function getSubmissionsLabel(role: AppRole | undefined) {
  void role;
  return 'My Submissions';
}

export function getFinanceDashboardTitle(role: AppRole) {
  return isAdminRole(role) ? 'Finance Review Workspace' : 'Finance Review';
}

export function getOverviewTitle(role: AppRole) {
  if (isEmployeeRole(role)) return 'My Finance Intake';
  if (isTeamLeadRole(role)) return 'Team Submission Overview';
  if (role === 'developer') return 'System Overview';
  if (role === 'finance') return 'Finance Operations Overview';
  return 'Admin Operations Overview';
}

export function getDrawerViewerRole(role: AppRole): AppRole {
  if (role === 'finance') return 'finance';
  if (role === 'developer') return 'developer';
  if (isTeamLeadRole(role)) return 'team_lead';
  if (isAdminRole(role)) return 'admin';
  return 'employee';
}
