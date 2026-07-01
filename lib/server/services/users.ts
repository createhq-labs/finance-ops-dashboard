import { randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, AppUser, BusinessLine } from '../types/submissions';
import { createServiceClient } from '../supabase';
import { logActivityEvent } from './activityLog';

export type UserStatus = 'active' | 'inactive';

export type UserAuditSnapshot = {
  actor_user_id: string | null;
  actor_name: string;
  actor_email: string | null;
  action_type: string;
  created_at: string;
};

export type ManagedUser = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: UserStatus;
  team_name: string | null;
  team_lead_id: string | null;
  business_line: BusinessLine | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deactivated_by?: string | null;
  deactivated_at?: string | null;
  audit_summary?: {
    created: UserAuditSnapshot | null;
    updated: UserAuditSnapshot | null;
    deactivated: UserAuditSnapshot | null;
    password_reset: UserAuditSnapshot | null;
  } | null;
};

type CreateUserInput = {
  email?: string;
  full_name?: string;
  role?: string;
  status?: string;
  team_name?: string | null;
  business_line?: string | null;
};

type UpdateUserInput = {
  full_name?: string;
  role?: string;
  status?: string;
  team_name?: string | null;
  business_line?: string | null;
};

const ROLES: AppRole[] = ['employee', 'team_lead', 'finance', 'admin', 'developer'];
const STATUSES: UserStatus[] = ['active', 'inactive'];
const USER_FIELDS = 'id, email, full_name, role, status, team_name, team_lead_id, business_line, created_at, updated_at, created_by, updated_by, deactivated_by, deactivated_at';

type ActivityLogRow = {
  actor_user_id: string | null;
  action_type: string | null;
  entity_id: string | null;
  created_at: string;
};

async function attachUserAuditSummaries(client: SupabaseClient, users: ManagedUser[]) {
  if (!users.length) return users;

  const userIds = users.map((entry) => entry.id);
  const directActorIds = Array.from(
    new Set(
      users
        .flatMap((entry) => [entry.created_by ?? null, entry.updated_by ?? null, entry.deactivated_by ?? null])
        .filter(Boolean) as string[]
    )
  );

  const { data: activityRows, error: activityError } = await client
    .from('activity_log')
    .select('actor_user_id, action_type, entity_id, created_at')
    .eq('entity_type', 'user')
    .in('entity_id', userIds)
    .in('action_type', ['user_created', 'user_updated', 'user_deactivated', 'user_status_changed', 'role_changed', 'business_line_changed', 'user_password_reset'])
    .order('created_at', { ascending: false });

  if (activityError) throw activityError;

  const actorIds = Array.from(
    new Set([
      ...directActorIds,
      ...(((activityRows ?? []) as ActivityLogRow[]).map((row) => row.actor_user_id).filter(Boolean) as string[]),
    ])
  );
  const actorNameById = new Map<string, { full_name: string | null; email: string | null }>();

  if (actorIds.length) {
    const { data: actorRows, error: actorError } = await client
      .from('users')
      .select('id, full_name, email')
      .in('id', actorIds);

    if (actorError) throw actorError;

    for (const actor of actorRows ?? []) {
      actorNameById.set(String(actor.id), {
        full_name: typeof actor.full_name === 'string' ? actor.full_name : null,
        email: typeof actor.email === 'string' ? actor.email : null,
      });
    }
  }

  const rowsByUserId = new Map<string, ActivityLogRow[]>();
  for (const row of (activityRows ?? []) as ActivityLogRow[]) {
    const entityId = row.entity_id ? String(row.entity_id) : '';
    if (!entityId) continue;
    const bucket = rowsByUserId.get(entityId) ?? [];
    bucket.push(row);
    rowsByUserId.set(entityId, bucket);
  }

  const buildSnapshotFromActor = (
    actorUserId: string | null | undefined,
    createdAt: string | null | undefined,
    actionType: string
  ): UserAuditSnapshot | null => {
    if (!actorUserId || !createdAt) return null;
    const actor = actorNameById.get(String(actorUserId));
    return {
      actor_user_id: actorUserId,
      actor_name: actor?.full_name || actor?.email || 'Unknown user',
      actor_email: actor?.email ?? null,
      action_type: actionType,
      created_at: createdAt,
    };
  };

  const buildSnapshotFromRow = (row: ActivityLogRow | undefined): UserAuditSnapshot | null => {
    if (!row) return null;
    const actor = row.actor_user_id ? actorNameById.get(String(row.actor_user_id)) : null;
    return {
      actor_user_id: row.actor_user_id ?? null,
      actor_name: actor?.full_name || actor?.email || 'Unknown user',
      actor_email: actor?.email ?? null,
      action_type: row.action_type ?? 'unknown',
      created_at: row.created_at,
    };
  };

  return users.map((entry) => {
    const rows = rowsByUserId.get(entry.id) ?? [];
    const createdRow = rows.find((row) => row.action_type === 'user_created');
    const deactivatedRow = rows.find((row) => row.action_type === 'user_deactivated');
    const passwordResetRow = rows.find((row) => row.action_type === 'user_password_reset');
    const updatedRow = rows.find((row) => row.action_type !== 'user_created' && row.action_type !== 'user_deactivated' && row.action_type !== 'user_password_reset');

    const created = buildSnapshotFromActor(entry.created_by, entry.created_at, 'user_created') ?? buildSnapshotFromRow(createdRow);
    const updated = buildSnapshotFromActor(entry.updated_by, entry.updated_at, 'user_updated') ?? buildSnapshotFromRow(updatedRow);
    const deactivated = buildSnapshotFromActor(entry.deactivated_by, entry.deactivated_at, 'user_deactivated') ?? buildSnapshotFromRow(deactivatedRow);
    const password_reset = buildSnapshotFromRow(passwordResetRow);

    return {
      ...entry,
      audit_summary: {
        created,
        updated,
        deactivated,
        password_reset,
      },
    };
  });
}

export function canManageUsers(role: AppRole) {
  return role === 'finance' || role === 'admin' || role === 'developer';
}

export function getCreatableRoles(actorRole: AppRole): AppRole[] {
  if (actorRole === 'finance') return ['employee', 'team_lead'];
  if (actorRole === 'admin' || actorRole === 'developer') {
    return ['employee', 'team_lead', 'finance', 'admin'];
  }
  return [];
}

export function getUpdatableRoles(actorRole: AppRole): AppRole[] {
  if (actorRole === 'finance') return ['employee', 'team_lead'];
  if (actorRole === 'admin' || actorRole === 'developer') {
    return ['employee', 'team_lead', 'finance', 'admin'];
  }
  return [];
}

function canChangeRoleForTarget(actorRole: AppRole, targetRole: AppRole) {
  if (actorRole === 'finance') return false;
  return targetRole === 'employee' || targetRole === 'team_lead';
}

function getAssignableRoleChanges(actorRole: AppRole, targetRole: AppRole): AppRole[] {
  if (!canChangeRoleForTarget(actorRole, targetRole)) return [];
  return ['employee', 'team_lead'];
}

export function isKnownRole(value: string): value is AppRole {
  return ROLES.includes(value as AppRole);
}

export function isKnownStatus(value: string): value is UserStatus {
  return STATUSES.includes(value as UserStatus);
}

function isCreateDomainEmail(email: string) {
  return email.toLowerCase().endsWith('@create.wtf');
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

function normalizeBusinessLine(value: string | null | undefined) {
  const next = String(value ?? '').trim().toUpperCase();
  if (!next) return null;
  if (next === 'IM' || next === 'TM') return next as BusinessLine;
  throw new Error('Invalid business line.');
}

function pickRandom(source: string) {
  return source[randomInt(0, source.length)];
}

function generateTemporaryPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = `${upper}${lower}${digits}`;

  const chars = [pickRandom(upper), pickRandom(lower), pickRandom(digits)];
  while (chars.length < 5) {
    chars.push(pickRandom(all));
  }

  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }

  return `Create@${chars.join('')}`;
}

function validateFullName(value: unknown) {
  const fullName = String(value ?? '').trim();
  if (!fullName) {
    throw new Error('Full name is required.');
  }
  return fullName;
}

function validateCreatePayload(actorRole: AppRole, input: CreateUserInput) {
  const email = normalizeEmail(String(input.email ?? ''));
  const full_name = validateFullName(input.full_name);
  const role = String(input.role ?? '');
  const status = String(input.status ?? 'active') || 'active';
  const team_name = normalizeOptionalText(input.team_name);
  const business_line = normalizeBusinessLine(input.business_line);

  if (!email) throw new Error('Email is required.');
  if (!isCreateDomainEmail(email)) {
    throw new Error('Only @create.wtf email addresses can be provisioned.');
  }
  if (!isKnownRole(role)) {
    throw new Error('Invalid role.');
  }
  if (!isKnownStatus(status)) {
    throw new Error('Invalid status.');
  }
  if (!getCreatableRoles(actorRole).includes(role)) {
    throw new Error('You are not allowed to create this role.');
  }
  if ((role === 'employee' || role === 'team_lead') && !business_line) {
    throw new Error('Business line is required for employee and team lead users.');
  }
  if ((role === 'finance' || role === 'admin' || role === 'developer') && business_line) {
    throw new Error('Finance, admin, and developer users must remain overall and cannot be assigned to IM or TM.');
  }

  return { email, full_name, role, status, team_name, business_line } as {
    email: string;
    full_name: string;
    role: AppRole;
    status: UserStatus;
    team_name: string | null;
    business_line: BusinessLine | null;
  };
}

async function getExistingUserByEmail(client: SupabaseClient, email: string) {
  const { data, error } = await client
    .from('users')
    .select(USER_FIELDS)
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data as ManagedUser | null;
}

async function getUserById(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from('users')
    .select(USER_FIELDS)
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error('User not found.');
  }

  return data as ManagedUser;
}

export async function listUsers(
  client: SupabaseClient,
  filters: { search?: string; role?: AppRole | 'all'; status?: UserStatus | 'all'; businessLine?: BusinessLine | 'all' }
) {
  const { data, error } = await client.from('users').select(USER_FIELDS).order('created_at', { ascending: false });

  if (error) throw error;

  const search = String(filters.search ?? '').trim().toLowerCase();
  const role = filters.role ?? 'all';
  const status = filters.status ?? 'all';
  const businessLine = filters.businessLine ?? 'all';

  const filtered = ((data ?? []) as ManagedUser[]).filter((user) => {
    if (role !== 'all' && user.role !== role) return false;
    if (status !== 'all' && user.status !== status) return false;
    if (businessLine !== 'all' && user.business_line !== businessLine) return false;
    if (search) {
      const haystack = `${user.full_name} ${user.email}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const auditClient = createServiceClient();
  return attachUserAuditSummaries(auditClient, filtered);
}

export async function createDashboardUser(
  serviceClient: SupabaseClient,
  actor: AppUser,
  input: CreateUserInput
) {
  if (!canManageUsers(actor.role)) {
    throw new Error('Forbidden');
  }

  const payload = validateCreatePayload(actor.role, input);
  const existing = await getExistingUserByEmail(serviceClient, payload.email);
  if (existing) {
    throw new Error('A user with this email already exists.');
  }

  const temporaryPassword = generateTemporaryPassword();
  const { data: authResult, error: authError } = await serviceClient.auth.admin.createUser({
    email: payload.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: payload.full_name },
  });

  if (authError || !authResult.user) {
    throw new Error(authError?.message || 'Failed to create auth user.');
  }

  try {
    const { data: createdUser, error: insertError } = await serviceClient
      .from('users')
      .insert({
        supabase_auth_id: authResult.user.id,
        email: payload.email,
        full_name: payload.full_name,
        role: payload.role,
        status: payload.status,
        team_name: payload.team_name,
        business_line: payload.business_line,
        created_by: actor.id,
        updated_by: null,
        deactivated_by: null,
        deactivated_at: null,
      })
      .select(USER_FIELDS)
      .single();

    if (insertError || !createdUser) {
      throw insertError || new Error('Failed to create app user.');
    }

    await logActivityEvent(serviceClient, {
      actorUserId: actor.id,
      action: 'user_created',
      details: {
        message: `User ${createdUser.full_name} was created.`,
        email: createdUser.email,
        role: createdUser.role,
        status: createdUser.status,
        business_line: createdUser.business_line,
      },
      structured: {
        action_type: 'user_created',
        entity_type: 'user',
        entity_id: String(createdUser.id),
        metadata: {
          email: createdUser.email,
          role: createdUser.role,
          status: createdUser.status,
          business_line: createdUser.business_line,
        },
      },
    });

    return {
      user: createdUser as ManagedUser,
      temporaryPassword,
      deliveryMethod: 'temporary_password' as const,
    };
  } catch (error) {
    const rollback = await serviceClient.auth.admin.deleteUser(authResult.user.id);
    if (rollback.error) {
      throw new Error(
        `${error instanceof Error ? error.message : 'Failed to create app user.'} Auth user cleanup also failed: ${rollback.error.message}`
      );
    }
    throw error instanceof Error ? error : new Error('Failed to create app user.');
  }
}

function sanitizeUpdatePayload(input: UpdateUserInput) {
  const payload: Partial<ManagedUser> = {};

  if (Object.prototype.hasOwnProperty.call(input, 'full_name')) {
    payload.full_name = validateFullName(input.full_name);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'team_name')) {
    payload.team_name = normalizeOptionalText(input.team_name) as string | null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'business_line')) {
    payload.business_line = normalizeBusinessLine(input.business_line);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    const status = String(input.status ?? '');
    if (!isKnownStatus(status)) throw new Error('Invalid status.');
    payload.status = status;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'role')) {
    const role = String(input.role ?? '');
    if (!isKnownRole(role)) throw new Error('Invalid role.');
    payload.role = role;
  }

  return payload;
}

export async function updateDashboardUser(
  serviceClient: SupabaseClient,
  actor: AppUser,
  userId: string,
  input: UpdateUserInput
) {
  if (!canManageUsers(actor.role)) {
    throw new Error('Forbidden');
  }

  const target = await getUserById(serviceClient, userId);
  const payload = sanitizeUpdatePayload(input);
  const isSelf = actor.id === target.id;

  if (actor.role === 'finance') {
    if (target.role !== 'employee' && target.role !== 'team_lead') {
      throw new Error('Finance can only update employee and team lead users.');
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'role')) {
      throw new Error('Finance cannot change user roles.');
    }
  } else {
    if (target.role === 'developer') {
      throw new Error('Developer users cannot be updated here.');
    }
    if (payload.role === 'developer') {
      throw new Error('Developer role cannot be assigned here.');
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'role') && payload.role && !getAssignableRoleChanges(actor.role, target.role).includes(payload.role)) {
      throw new Error('Only employee and team lead role changes are allowed here.');
    }
  }

  if (isSelf) {
    if (payload.status === 'inactive') {
      throw new Error('You cannot deactivate your own account.');
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'role')) {
      throw new Error('You cannot change your own role.');
    }
  }

  const allowedTargetRoles = getUpdatableRoles(actor.role);
  if (!allowedTargetRoles.includes(target.role)) {
    throw new Error('You are not allowed to update this user.');
  }

  if (actor.role !== 'finance' && payload.role && !getCreatableRoles(actor.role).includes(payload.role)) {
    throw new Error('You are not allowed to assign this role.');
  }

  const updateData: Record<string, string | null> = {};
  if (typeof payload.full_name === 'string' && payload.full_name !== target.full_name) {
    updateData.full_name = payload.full_name;
  }
  if (typeof payload.team_name !== 'undefined' && payload.team_name !== target.team_name) {
    updateData.team_name = payload.team_name;
  }
  if (payload.status && payload.status !== target.status) {
    updateData.status = payload.status;
  }
  if (payload.role && payload.role !== target.role) {
    updateData.role = payload.role;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'business_line')) {
    const desiredBusinessLine = payload.business_line ?? null;
    if ((payload.role === 'employee' || payload.role === 'team_lead' || (!payload.role && (target.role === 'employee' || target.role === 'team_lead'))) && !desiredBusinessLine) {
      throw new Error('Business line is required for employee and team lead users.');
    }
    if (desiredBusinessLine !== target.business_line) {
      updateData.business_line = desiredBusinessLine;
    }
  }

  const finalRole = payload.role ?? target.role;
  const finalBusinessLine = Object.prototype.hasOwnProperty.call(payload, 'business_line')
    ? payload.business_line ?? null
    : target.business_line;
  if ((finalRole === 'employee' || finalRole === 'team_lead') && !finalBusinessLine) {
    throw new Error('Business line is required for employee and team lead users.');
  }
  if ((finalRole === 'finance' || finalRole === 'admin' || finalRole === 'developer') && finalBusinessLine) {
    throw new Error('Finance, admin, and developer users must remain overall and cannot be assigned to IM or TM.');
  }

  if (finalRole === 'finance' || finalRole === 'admin' || finalRole === 'developer') {
    updateData.business_line = null;
  }

  if (Object.keys(updateData).length === 0) {
    return target;
  }

  const updateTimestamp = new Date().toISOString();
  updateData.updated_by = actor.id;
  updateData.updated_at = updateTimestamp;

  if (payload.status === 'inactive' && target.status !== 'inactive') {
    updateData.deactivated_by = actor.id;
    updateData.deactivated_at = updateTimestamp;
  } else if (payload.status === 'active' && target.status === 'inactive') {
    updateData.deactivated_by = null;
    updateData.deactivated_at = null;
  }

  const { data, error } = await serviceClient
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select(USER_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update user.');
  }

  const updatedUser = data as ManagedUser;
  if (target.role !== updatedUser.role) {
    await logActivityEvent(serviceClient, {
      actorUserId: actor.id,
      action: 'role_changed',
      details: {
        message: `Role changed for ${updatedUser.full_name}.`,
        old_value: target.role,
        new_value: updatedUser.role,
        email: updatedUser.email,
      },
      structured: {
        action_type: 'role_changed',
        from_status: target.role,
        to_status: updatedUser.role,
        entity_type: 'user',
        entity_id: String(updatedUser.id),
        metadata: {
          email: updatedUser.email,
          old_value: target.role,
          new_value: updatedUser.role,
          business_line: updatedUser.business_line,
          financial_year: null,
          module: 'users',
        },
      },
    });
  }

  if (target.business_line !== updatedUser.business_line) {
    await logActivityEvent(serviceClient, {
      actorUserId: actor.id,
      action: 'business_line_changed',
      details: {
        message: `Business line changed for ${updatedUser.full_name}.`,
        old_value: target.business_line,
        new_value: updatedUser.business_line,
        email: updatedUser.email,
      },
      structured: {
        action_type: 'business_line_changed',
        from_status: target.business_line,
        to_status: updatedUser.business_line,
        entity_type: 'user',
        entity_id: String(updatedUser.id),
        metadata: {
          email: updatedUser.email,
          old_value: target.business_line,
          new_value: updatedUser.business_line,
          role: updatedUser.role,
        },
      },
    });
  }

  if (target.status !== updatedUser.status) {
    await logActivityEvent(serviceClient, {
      actorUserId: actor.id,
      action: updatedUser.status === 'inactive' ? 'user_deactivated' : 'user_status_changed',
      details: {
        message: updatedUser.status === 'inactive'
          ? `${updatedUser.full_name} was deactivated.`
          : `Status changed for ${updatedUser.full_name}.`,
        old_value: target.status,
        new_value: updatedUser.status,
        email: updatedUser.email,
      },
      structured: {
        action_type: updatedUser.status === 'inactive' ? 'user_deactivated' : 'user_status_changed',
        from_status: target.status,
        to_status: updatedUser.status,
        entity_type: 'user',
        entity_id: String(updatedUser.id),
        metadata: {
          email: updatedUser.email,
          old_value: target.status,
          new_value: updatedUser.status,
          role: updatedUser.role,
          business_line: updatedUser.business_line,
        },
      },
    });
  }

  if (target.full_name !== updatedUser.full_name || target.team_name !== updatedUser.team_name) {
    await logActivityEvent(serviceClient, {
      actorUserId: actor.id,
      action: 'user_updated',
      details: {
        message: `Profile details updated for ${updatedUser.full_name}.`,
        email: updatedUser.email,
      },
      structured: {
        action_type: 'user_updated',
        entity_type: 'user',
        entity_id: String(updatedUser.id),
        metadata: {
          email: updatedUser.email,
          role: updatedUser.role,
          business_line: updatedUser.business_line,
          old_full_name: target.full_name,
          new_full_name: updatedUser.full_name,
          old_team_name: target.team_name,
          new_team_name: updatedUser.team_name,
        },
      },
    });
  }

  return updatedUser;
}

export function canResetPassword(actorRole: AppRole, actorId: string, target: ManagedUser) {
  if (target.id === actorId) return false;
  if (actorRole === 'finance') return target.role === 'employee' || target.role === 'team_lead';
  if (actorRole === 'admin' || actorRole === 'developer') return target.role !== 'developer';
  return false;
}

export async function resetDashboardUserPassword(
  serviceClient: SupabaseClient,
  actor: AppUser,
  userId: string
) {
  if (!canManageUsers(actor.role)) {
    throw new Error('Forbidden');
  }

  const { data: target, error: targetError } = await serviceClient
    .from('users')
    .select('id, email, full_name, role, status, team_name, team_lead_id, business_line, created_at, updated_at, supabase_auth_id')
    .eq('id', userId)
    .single();

  if (targetError || !target) {
    throw new Error('User not found.');
  }

  if (!canResetPassword(actor.role, actor.id, target as ManagedUser)) {
    throw new Error('You are not allowed to reset this user password.');
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error } = await serviceClient.auth.admin.updateUserById(target.supabase_auth_id, {
    password: temporaryPassword,
  });

  if (error) {
    throw new Error(error.message || 'Failed to reset password.');
  }

  await logActivityEvent(serviceClient, {
    actorUserId: actor.id,
    action: 'user_password_reset',
    details: {
      message: `Password reset for ${target.full_name}.`,
      email: target.email,
      role: target.role,
      business_line: target.business_line,
    },
    structured: {
      action_type: 'user_password_reset',
      entity_type: 'user',
      entity_id: String(target.id),
      metadata: {
        email: target.email,
        role: target.role,
        business_line: target.business_line,
        financial_year: null,
        module: 'users',
      },
    },
  });

  return {
    user: target as ManagedUser,
    temporaryPassword,
  };
}

