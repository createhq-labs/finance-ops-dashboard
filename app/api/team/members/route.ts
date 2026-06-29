import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, getCurrentAppUser } from '../../../../lib/server/auth';
import { assertSupabaseEnv, createServiceClient, createUserScopedClient } from '../../../../lib/server/supabase';
import { getAccessTokenFromCookieHeader } from '../../../../lib/server/services/authCookies';
import {
  addTeamLeadMember,
  listTeamLeadMembers,
  removeTeamLeadMember,
  searchTeamLeadCandidates,
} from '../../../../lib/server/services/team';

function resolveToken(req: NextRequest) {
  try {
    return getBearerToken(req);
  } catch {
    return getAccessTokenFromCookieHeader(req.cookies) ?? '';
  }
}

function ensureTeamLead(role: string) {
  if (role !== 'team_lead') {
    throw new Error('Unauthorized');
  }
}

export async function GET(req: NextRequest) {
  try {
    assertSupabaseEnv();
    const token = resolveToken(req);
    if (!token) throw new Error('Missing auth token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);
    ensureTeamLead(appUser.role);

    const search = req.nextUrl.searchParams.get('search') || '';
    const adminClient = createServiceClient();

    const [members, candidates] = await Promise.all([
      listTeamLeadMembers(adminClient, appUser.id),
      searchTeamLeadCandidates(adminClient, appUser.id, search, appUser.business_line ?? null),
    ]);

    return NextResponse.json({ success: true, members, candidates }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load team members.' },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSupabaseEnv();
    const token = resolveToken(req);
    if (!token) throw new Error('Missing auth token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);
    ensureTeamLead(appUser.role);

    const body = (await req.json().catch(() => ({}))) as { employee_id?: string };
    const employeeId = String(body.employee_id || '').trim();
    if (!employeeId) throw new Error('employee_id is required');

    const adminClient = createServiceClient();
    const result = await addTeamLeadMember(adminClient, appUser.id, employeeId, appUser.id, appUser.business_line ?? null);

    return NextResponse.json(
      {
        success: true,
        member: {
          employee_id: result.mapping.employee_id,
          full_name: result.employee.full_name,
          email: result.employee.email,
          status: result.employee.status,
          business_line: result.employee.business_line ?? null,
          created_at: result.mapping.created_at,
          created_by: result.mapping.created_by,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add team member.';
    const status = message.includes('already') ? 409 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    assertSupabaseEnv();
    const token = resolveToken(req);
    if (!token) throw new Error('Missing auth token');

    const userClient = createUserScopedClient(token);
    const appUser = await getCurrentAppUser(userClient, token);
    ensureTeamLead(appUser.role);

    const body = (await req.json().catch(() => ({}))) as { employee_id?: string };
    const employeeId = String(body.employee_id || '').trim();
    if (!employeeId) throw new Error('employee_id is required');

    const adminClient = createServiceClient();
    await removeTeamLeadMember(adminClient, appUser.id, employeeId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove team member.';
    const status = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
