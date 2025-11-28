import { supabase } from './supabase';
import type {
  Activity,
  Driver,
  List,
  Requirement,
  RequirementDriverValue,
  TechnologyPreset,
  Risk,
} from '@/types/database';

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function requireSingle<T>(promise: Promise<{ data: T | null; error: unknown; status: number }>): Promise<T> {
  const { data, error, status } = await promise;
  if (error || !data) {
    const message = error && typeof error === 'object' && 'message' in error ? (error as { message: string }).message : 'Resource not found';
    throw new ApiError(message, status, error);
  }
  return data;
}

export async function fetchListForUser(listId: string, userId: string): Promise<List> {
  return requireSingle(
    supabase
      .from('lists')
      .select('*')
      .eq('id', listId)
      .eq('user_id', userId)
      .single(),
  );
}

export async function fetchRequirementForUser(listId: string, reqId: string, _userId: string): Promise<Requirement> {
  return requireSingle(
    supabase
      .from('requirements')
      .select('*')
      .eq('id', reqId)
      .eq('list_id', listId)
      .single(),
  );
}

export async function fetchTechnologyPreset(presetId: string): Promise<TechnologyPreset | null> {
  const { data, error } = await supabase
    .from('technology_presets')
    .select('*')
    .eq('id', presetId)
    .single();

  if (error) {
    console.warn('Failed to fetch technology preset', error);
    return null;
  }
  return data;
}

export interface EstimationMasterData {
  presets: TechnologyPreset[];
  activities: Activity[];
  drivers: Driver[];
  risks: Risk[];
}

export async function fetchEstimationMasterData(): Promise<EstimationMasterData> {
  const [presetsRes, activitiesRes, driversRes, risksRes, tpaRes] = await Promise.all([
    supabase.from('technology_presets').select('*').order('name'),
    supabase.from('activities').select('*').eq('active', true).order('group, name'),
    supabase.from('drivers').select('*').order('code'),
    supabase.from('risks').select('*').order('weight'),
    supabase.from('technology_preset_activities').select('tech_preset_id, activity_id, position'),
  ]);

  if (presetsRes.error) throw presetsRes.error;
  if (activitiesRes.error) throw activitiesRes.error;
  if (driversRes.error) throw driversRes.error;
  if (risksRes.error) throw risksRes.error;
  if (tpaRes.error) throw tpaRes.error;

  const activityById = new Map<string, Activity>();
  (activitiesRes.data || []).forEach((a) => activityById.set(a.id, a));

  const pivotByPreset = new Map<string, { activity_id: string; position: number | null }[]>();
  (tpaRes.data as { tech_preset_id: string; activity_id: string; position: number | null }[] | null || []).forEach((row) => {
    if (!pivotByPreset.has(row.tech_preset_id)) {
      pivotByPreset.set(row.tech_preset_id, []);
    }
    pivotByPreset.get(row.tech_preset_id)!.push({
      activity_id: row.activity_id,
      position: row.position ?? null,
    });
  });

  const normalizedPresets: TechnologyPreset[] = (presetsRes.data || []).map((p) => {
    const rows = pivotByPreset.get(p.id) || [];
    if (rows.length === 0) return p;

    const codes = rows
      .sort((a, b) => {
        const pa = a.position ?? Number.MAX_SAFE_INTEGER;
        const pb = b.position ?? Number.MAX_SAFE_INTEGER;
        return pa - pb;
      })
      .map((r) => activityById.get(r.activity_id)?.code)
      .filter((code): code is string => Boolean(code));

    if (codes.length === 0) return p;
    return { ...p, default_activity_codes: codes };
  });

  return {
    presets: normalizedPresets,
    activities: activitiesRes.data || [],
    drivers: driversRes.data || [],
    risks: risksRes.data || [],
  };
}

export async function fetchPresets(): Promise<TechnologyPreset[]> {
  const { data, error } = await supabase.from('technology_presets').select('*').order('name');
  if (error) {
    throw new ApiError(error.message || 'Unable to load technology presets', error.status, error);
  }
  return data || [];
}

export interface CreateListInput {
  userId: string;
  name: string;
  description?: string;
  owner?: string;
  techPresetId?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

export async function createList(input: CreateListInput): Promise<List> {
  const payload = {
    user_id: input.userId,
    name: input.name,
    description: input.description || '',
    owner: input.owner || '',
    tech_preset_id: input.techPresetId ?? null,
    status: input.status,
  };

  return requireSingle(
    supabase
      .from('lists')
      .insert(payload)
      .select('*')
      .single(),
  );
}

export async function generateNextRequirementId(listId: string): Promise<string> {
  const { data, error } = await supabase
    .from('requirements')
    .select('req_id')
    .eq('list_id', listId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new ApiError(error.message || 'Unable to generate requirement id', error.status, error);
  }

  if (!data || data.length === 0) return 'REQ-001';

  const numbers = data
    .map((req) => {
      const match = req.req_id?.match(/REQ-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((num) => num > 0);

  const nextNumber = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
  return `REQ-${String(nextNumber).padStart(3, '0')}`;
}

export interface CreateRequirementInput {
  listId: string;
  title: string;
  description?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  state: 'PROPOSED' | 'SELECTED' | 'SCHEDULED' | 'DONE';
  business_owner?: string;
  tech_preset_id?: string | null;
  req_id?: string;
}

export async function createRequirement(input: CreateRequirementInput): Promise<Requirement> {
  const reqId = input.req_id || (await generateNextRequirementId(input.listId));
  const payload = {
    list_id: input.listId,
    req_id: reqId,
    title: input.title,
    description: input.description || '',
    priority: input.priority,
    state: input.state,
    business_owner: input.business_owner || '',
    tech_preset_id: input.tech_preset_id ?? null,
    labels: [],
  };

  return requireSingle(
    supabase
      .from('requirements')
      .insert(payload)
      .select('*')
      .single(),
  );
}

export async function fetchRequirementBundle(listId: string, reqId: string, userId: string) {
  const list = await fetchListForUser(listId, userId);
  const requirement = await fetchRequirementForUser(listId, reqId, userId);

  const techPresetId = requirement.tech_preset_id || list.tech_preset_id;
  const preset = techPresetId ? await fetchTechnologyPreset(techPresetId) : null;

  const { data: driverValues, error: driverErr } = await supabase
    .from('requirement_driver_values')
    .select('*')
    .eq('requirement_id', requirement.id);
  if (driverErr) {
    console.warn('Failed to load requirement driver values', driverErr);
  }

  return { list, requirement, preset, driverValues: (driverValues || []) as RequirementDriverValue[] };
}
