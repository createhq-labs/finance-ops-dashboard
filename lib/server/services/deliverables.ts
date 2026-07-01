import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, BusinessLine } from '../types/submissions';
import { logActivityEvent } from './activityLog';

export type ManagedDeliverable = {
  id: string;
  name: string;
  business_line: BusinessLine | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type DeliverableInput = {
  name?: string;
  business_line?: string | null;
  is_active?: boolean;
};

const DELIVERABLE_FIELDS = 'id, name, business_line, is_active, created_by, created_at, updated_at';

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').trim();
}

function normalizeBusinessLine(value: string | null | undefined) {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) return null;
  if (normalized === 'IM' || normalized === 'TM') return normalized as BusinessLine;
  throw new Error('Invalid business line.');
}

export function canManageDeliverables(role: AppRole) {
  return role === 'admin' || role === 'developer';
}

function validateName(value: string | null | undefined) {
  const next = normalizeText(value);
  if (!next) {
    throw new Error('Deliverable name is required.');
  }
  return next;
}

function sanitizeInput(input: DeliverableInput) {
  const payload: Partial<ManagedDeliverable> = {};

  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    payload.name = validateName(input.name);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'business_line')) {
    payload.business_line = normalizeBusinessLine(input.business_line);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'is_active')) {
    payload.is_active = Boolean(input.is_active);
  }

  return payload;
}

export async function listDeliverables(client: SupabaseClient) {
  const { data, error } = await client
    .from('deliverables')
    .select(DELIVERABLE_FIELDS)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ManagedDeliverable[];
}

export async function createDeliverable(client: SupabaseClient, actorId: string, input: DeliverableInput) {
  const payload = sanitizeInput(input);
  if (!payload.name) {
    throw new Error('Deliverable name is required.');
  }

  const { data: duplicate, error: duplicateError } = await client
    .from('deliverables')
    .select(DELIVERABLE_FIELDS)
    .eq('name', payload.name)
    .maybeSingle();

  if (duplicateError) throw duplicateError;
  if (duplicate) {
    throw new Error('A deliverable with this name already exists.');
  }

  const { data, error } = await client
    .from('deliverables')
    .insert({
      name: payload.name,
      business_line: payload.business_line ?? null,
      is_active: typeof payload.is_active === 'boolean' ? payload.is_active : true,
      created_by: actorId,
    })
    .select(DELIVERABLE_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create deliverable.');
  }

  await logActivityEvent(client, {
    actorUserId: actorId,
    action: 'deliverable_added',
    details: {
      message: `Deliverable ${data.name} was created.`,
      deliverable_name: data.name,
      business_line: data.business_line,
      is_active: data.is_active,
    },
    structured: {
      action_type: 'deliverable_added',
      entity_type: 'deliverable',
      entity_id: String(data.id),
      metadata: {
        deliverable_name: data.name,
        business_line: data.business_line,
        is_active: data.is_active,
      },
    },
  });

  return data as ManagedDeliverable;
}

export async function updateDeliverable(
  client: SupabaseClient,
  actorId: string,
  id: string,
  input: DeliverableInput
) {
  const payload = sanitizeInput(input);
  const { data: existing, error: existingError } = await client
    .from('deliverables')
    .select(DELIVERABLE_FIELDS)
    .eq('id', id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) throw new Error('Deliverable not found.');

  if (Object.prototype.hasOwnProperty.call(payload, 'name') && payload.name) {
    const { data: duplicate, error: duplicateError } = await client
      .from('deliverables')
      .select(DELIVERABLE_FIELDS)
      .eq('name', payload.name)
      .neq('id', id)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicate) {
      throw new Error('A deliverable with this name already exists.');
    }
  }

  const updateData: Record<string, string | boolean | null> = {};
  if (typeof payload.name === 'string') updateData.name = payload.name;
  if (Object.prototype.hasOwnProperty.call(payload, 'business_line')) updateData.business_line = payload.business_line ?? null;
  if (typeof payload.is_active === 'boolean') updateData.is_active = payload.is_active;

  if (Object.keys(updateData).length === 0) {
    return existing as ManagedDeliverable;
  }

  const { data, error } = await client
    .from('deliverables')
    .update(updateData)
    .eq('id', id)
    .select(DELIVERABLE_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update deliverable.');
  }

  await logActivityEvent(client, {
    actorUserId: actorId,
    action: 'deliverable_updated',
    details: {
      message: `Deliverable ${existing.name} was updated.`,
      old_value: {
        name: existing.name,
        business_line: existing.business_line,
        is_active: existing.is_active,
      },
      new_value: {
        name: data.name,
        business_line: data.business_line,
        is_active: data.is_active,
      },
    },
    structured: {
      action_type: 'deliverable_updated',
      entity_type: 'deliverable',
      entity_id: String(data.id),
      metadata: {
        old_value: {
          name: existing.name,
          business_line: existing.business_line,
          is_active: existing.is_active,
        },
        new_value: {
          name: data.name,
          business_line: data.business_line,
          is_active: data.is_active,
          financial_year: null,
          module: 'deliverables',
        },
      },
    },
  });

  return data as ManagedDeliverable;
}

