import { supabase } from './supabase';
import type {
  Activity,
  Driver,
  EstimationBlueprintRow,
  ImpactMapRow,
  Project,
  Requirement,
  RequirementDriverValue,
  RequirementUnderstandingRow,
  Technology,
  TechnologyPreset,
  Risk,
  Organization,
  OrganizationMember
} from '@/types/database';
import {
  fetchProject as repoFetchProject,
  createProject as repoCreateProject,
  PROJECT_FK,
} from '@/lib/projects';
import type { CreateProjectInput as RepoCreateProjectInput } from '@/lib/projects';

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

async function requireSingle<T>(promise: PromiseLike<{ data: T | null; error: unknown; status: number }>): Promise<T> {
  const { data, error, status } = await promise;
  if (error || !data) {
    const message = error && typeof error === 'object' && 'message' in error ? (error as { message: string }).message : 'Resource not found';
    throw new ApiError(message, status, error);
  }
  return data;
}

export async function fetchProject(projectId: string): Promise<Project> {
  return repoFetchProject(projectId);
}

export async function fetchRequirement(projectId: string, reqId: string): Promise<Requirement> {
  return requireSingle(
    supabase
      .from('requirements')
      .select('*')
      .eq('id', reqId)
      .eq(PROJECT_FK, projectId)
      .single(),
  );
}

export async function fetchTechnology(technologyId: string): Promise<Technology | null> {
  const { data, error } = await supabase
    .from('technologies')
    .select('*')
    .eq('id', technologyId)
    .single();

  if (error) {
    console.warn('Failed to fetch technology', error);
    return null;
  }
  return data;
}

export interface EstimationMasterData {
  technologies: Technology[];
  /** @deprecated Use technologies */
  presets: Technology[];
  activities: Activity[];
  drivers: Driver[];
  risks: Risk[];
}

// Session-level cache for master data (avoids triple-fetch during wizard save)
let _masterDataCache: { data: EstimationMasterData; ts: number } | null = null;
const MASTER_DATA_TTL_MS = 15_000; // 15 seconds — covers the UI preview → save → snapshot window

export async function fetchEstimationMasterData(): Promise<EstimationMasterData> {
  // Return cached data if still fresh
  if (_masterDataCache && Date.now() - _masterDataCache.ts < MASTER_DATA_TTL_MS) {
    return _masterDataCache.data;
  }

  const [techRes, activitiesRes, driversRes, risksRes, tpaRes] = await Promise.all([
    supabase.from('technologies').select('*').order('name'),
    supabase.from('activities').select('*').eq('active', true).order('group, name'),
    supabase.from('drivers').select('*').order('code'),
    supabase.from('risks').select('*').order('weight'),
    supabase.from('technology_activities').select('technology_id, activity_id, position'),
  ]);

  if (techRes.error) throw techRes.error;
  if (activitiesRes.error) throw activitiesRes.error;
  if (driversRes.error) throw driversRes.error;
  if (risksRes.error) throw risksRes.error;
  if (tpaRes.error) throw tpaRes.error;

  const technologies: Technology[] = techRes.data || [];

  const result: EstimationMasterData = {
    technologies,
    presets: technologies, // backward compat
    activities: activitiesRes.data || [],
    drivers: driversRes.data || [],
    risks: risksRes.data || [],
  };

  _masterDataCache = { data: result, ts: Date.now() };
  return result;
}

export async function fetchTechnologies(): Promise<Technology[]> {
  const { data, error, status } = await supabase.from('technologies').select('*').order('name');
  if (error) {
    throw new ApiError(error.message || 'Unable to load technologies', status, error);
  }
  return data || [];
}

/** @deprecated Use fetchTechnologies */
export const fetchPresets = fetchTechnologies;

export interface CreateProjectInput {
  userId: string;
  organizationId: string;
  name: string;
  description?: string;
  owner?: string;
  techPresetId?: string | null; // legacy alias
  technologyId?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  projectType?: string | null;
  domain?: string | null;
  scope?: string | null;
  teamSize?: number | null;
  deadlinePressure?: string | null;
  methodology?: string | null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const repoInput: RepoCreateProjectInput = {
    userId: input.userId,
    organizationId: input.organizationId,
    name: input.name,
    description: input.description,
    owner: input.owner,
    technologyId: input.technologyId ?? input.techPresetId ?? null,
    status: input.status,
    projectType: input.projectType,
    domain: input.domain,
    scope: input.scope,
    teamSize: input.teamSize,
    deadlinePressure: input.deadlinePressure,
    methodology: input.methodology,
  };
  return repoCreateProject(repoInput);
}

export async function generateNextRequirementId(projectId: string): Promise<string> {
  const { data, error, status } = await supabase
    .from('requirements')
    .select('req_id')
    .eq(PROJECT_FK, projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new ApiError(error.message || 'Unable to generate requirement id', status, error);
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
  projectId: string;
  title: string;
  description?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  state: 'PROPOSED' | 'SELECTED' | 'SCHEDULED' | 'DONE';
  business_owner?: string;
  tech_preset_id?: string | null; // legacy alias
  technology_id?: string | null;
  req_id?: string;
}

export async function createRequirement(input: CreateRequirementInput): Promise<Requirement> {
  const reqId = input.req_id || (await generateNextRequirementId(input.projectId));
  const payload = {
    [PROJECT_FK]: input.projectId,
    req_id: reqId,
    title: input.title,
    description: input.description || '',
    priority: input.priority,
    state: input.state,
    business_owner: input.business_owner || '',
    technology_id: input.technology_id ?? input.tech_preset_id ?? null,
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

export async function fetchEstimationDetails(estimationId: string) {
  const { data: estimation, error } = await supabase
    .from('estimations')
    .select(`
      *,
      estimation_activities(*),
      estimation_drivers(*),
      estimation_risks(*)
    `)
    .eq('id', estimationId)
    .single();

  if (error) throw error;
  return estimation;
}

export async function fetchRequirementBundle(projectId: string, reqId: string, _userId: string) {
  const project = await fetchProject(projectId);
  const requirement = await fetchRequirement(projectId, reqId);

  const technologyId = requirement.technology_id || project.technology_id;
  const preset = technologyId ? await fetchTechnology(technologyId) : null;

  const { data: driverValues, error: driverErr } = await supabase
    .from('requirement_driver_values')
    .select('*')
    .eq('requirement_id', requirement.id);
  if (driverErr) {
    console.warn('Failed to load requirement driver values', driverErr);
  }

  let assignedEstimation = null;
  if (requirement.assigned_estimation_id) {
    try {
      assignedEstimation = await fetchEstimationDetails(requirement.assigned_estimation_id);
    } catch (e) {
      console.warn('Failed to load assigned estimation', e);
    }
  }

  return {
    project,
    requirement,
    preset,
    driverValues: (driverValues || []) as RequirementDriverValue[],
    assignedEstimation
  };
}
export interface SaveEstimationInput {
  requirementId: string;
  userId: string;
  totalDays: number;
  baseDays: number;
  driverMultiplier: number;
  riskScore: number;
  contingencyPercent: number;
  aiReasoning?: string;
  blueprintId?: string;
  analysisId?: string;
  decisionId?: string;
  seniorConsultantAnalysis?: Record<string, unknown>;
  activities: {
    code: string;
    isAiSuggested: boolean;
  }[];
  drivers: {
    code: string;
    value: string;
  }[];
  risks: {
    code: string;
  }[];
}

export async function saveEstimation(input: SaveEstimationInput): Promise<string> {
  // 0. Validate input
  if (!input.activities || input.activities.length === 0) {
    throw new ApiError('Cannot save an estimation without activities', 400);
  }

  // 1. Get master data to map codes to IDs
  const masterData = await fetchEstimationMasterData();

  // 2. Map codes → IDs
  const activities = input.activities.map((a) => {
    const activity = masterData.activities.find((ma) => ma.code === a.code);
    if (!activity) return null;
    return { activity_id: activity.id, is_ai_suggested: a.isAiSuggested, notes: '', complexity_variant: null };
  }).filter((i): i is NonNullable<typeof i> => i !== null);

  const drivers = input.drivers.map((d) => {
    const driver = masterData.drivers.find((md) => md.code === d.code);
    if (!driver) return null;
    return { driver_id: driver.id, selected_value: d.value };
  }).filter((i): i is NonNullable<typeof i> => i !== null);

  const risks = input.risks.map((r) => {
    const risk = masterData.risks.find((mr) => mr.code === r.code);
    if (!risk) return null;
    return { risk_id: risk.id };
  }).filter((i): i is NonNullable<typeof i> => i !== null);

  // 3. Delegate to the unified RPC-based save
  const estimationId = await saveEstimationByIds({
    requirementId: input.requirementId,
    userId: input.userId,
    totalDays: input.totalDays,
    baseHours: input.baseDays * 8,
    driverMultiplier: input.driverMultiplier,
    riskScore: input.riskScore,
    contingencyPercent: input.contingencyPercent,
    scenarioName: 'Wizard',
    aiReasoning: input.aiReasoning,
    seniorConsultantAnalysis: input.seniorConsultantAnalysis,
    blueprintId: input.blueprintId,
    analysisId: input.analysisId,
    decisionId: input.decisionId,
    activities,
    drivers: drivers.length > 0 ? drivers : null,
    risks: risks.length > 0 ? risks : null,
  });

  // 4. Update requirement_driver_values for persistence across sessions
  const reqDriverInserts = input.drivers.map((d) => {
    const driver = masterData.drivers.find((md) => md.code === d.code);
    if (!driver) return null;
    return {
      requirement_id: input.requirementId,
      driver_id: driver.id,
      selected_value: d.value,
      source: 'USER',
    };
  }).filter((i): i is NonNullable<typeof i> => i !== null);

  if (reqDriverInserts.length > 0) {
    await supabase.from('requirement_driver_values').delete().eq('requirement_id', input.requirementId);
    await supabase.from('requirement_driver_values').insert(reqDriverInserts);
  }

  return estimationId;
}

/**
 * Low-level save function that accepts pre-resolved IDs and delegates to the
 * transactional RPC `save_estimation_atomic`. Use this when the caller already
 * has activity/driver/risk UUIDs (e.g. RequirementDetail, BulkEstimate).
 */
export interface SaveEstimationByIdsInput {
  requirementId: string;
  userId: string;
  totalDays: number;
  baseHours: number;
  driverMultiplier: number;
  riskScore: number;
  contingencyPercent: number;
  scenarioName: string;
  aiReasoning?: string | null;
  seniorConsultantAnalysis?: Record<string, unknown> | null;
  blueprintId?: string | null;
  analysisId?: string | null;
  decisionId?: string | null;
  activities: { activity_id: string; is_ai_suggested: boolean; notes?: string | null; complexity_variant?: string | null }[];
  drivers?: { driver_id: string; selected_value: string }[] | null;
  risks?: { risk_id: string }[] | null;
}

export async function saveEstimationByIds(input: SaveEstimationByIdsInput): Promise<string> {
  if (!input.activities || input.activities.length === 0) {
    throw new ApiError('Cannot save an estimation without activities', 400);
  }

  const { data, error } = await supabase.rpc('save_estimation_atomic', {
    p_requirement_id: input.requirementId,
    p_user_id: input.userId,
    p_total_days: input.totalDays,
    p_base_hours: input.baseHours,
    p_driver_multiplier: input.driverMultiplier,
    p_risk_score: input.riskScore,
    p_contingency_percent: input.contingencyPercent,
    p_scenario_name: input.scenarioName,
    p_activities: input.activities.map(a => ({
      activity_id: a.activity_id,
      is_ai_suggested: a.is_ai_suggested,
      notes: a.notes || '',
    })),
    p_drivers: input.drivers && input.drivers.length > 0 ? input.drivers : null,
    p_risks: input.risks && input.risks.length > 0 ? input.risks : null,
    p_ai_reasoning: input.aiReasoning || null,
    p_senior_consultant_analysis: input.seniorConsultantAnalysis || null,
    p_blueprint_id: input.blueprintId || null,
    p_analysis_id: input.analysisId || null,
    p_decision_id: input.decisionId || null,
  });

  if (error) {
    throw new ApiError(`Failed to save estimation: ${error.message}`, undefined, error);
  }

  // RPC returns [{estimation_id, activities_count, ...}]
  const row = Array.isArray(data) ? data[0] : data;
  return row?.estimation_id ?? '';
}

// --- Organization Management ---

export async function createTeamOrganization(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_team_organization', {
    org_name: name,
  });

  if (error) throw new ApiError(error.message, parseInt(error.code), error);
  return data; // Returns the new org ID
}

export async function getOrganizationMembers(orgId: string): Promise<{
  user_id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  joined_at: string;
}[]> {
  const { data, error } = await supabase.rpc('get_org_members_details', {
    target_org_id: orgId,
  });

  if (error) throw new ApiError(error.message, parseInt(error.code), error);
  return data;
}

export async function addMemberByEmail(orgId: string, email: string, role: 'admin' | 'editor' | 'viewer'): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('add_member_by_email', {
    target_org_id: orgId,
    target_email: email,
    target_role: role,
  });

  if (error) throw new ApiError(error.message, parseInt(error.code), error);
  return data;
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_org_member', {
    target_org_id: orgId,
    target_user_id: userId,
  });

  if (error) throw new ApiError(error.message, parseInt(error.code), error);
}

export async function updateMemberRole(orgId: string, userId: string, newRole: 'admin' | 'editor' | 'viewer'): Promise<void> {
  const { error } = await supabase.rpc('update_org_member_role', {
    target_org_id: orgId,
    target_user_id: userId,
    new_role: newRole,
  });

  if (error) throw new ApiError(error.message, parseInt(error.code), error);
}

// ── Requirement Understanding persistence ──

export interface SaveRequirementUnderstandingInput {
  requirementId?: string;
  understanding: Record<string, unknown>;
  inputDescription: string;
  inputTechCategory?: string;
}

export async function saveRequirementUnderstanding(
  input: SaveRequirementUnderstandingInput
): Promise<RequirementUnderstandingRow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError('Utente non autenticato', 401);

  // Determine version: max existing version + 1
  let version = 1;
  if (input.requirementId) {
    const { data: existing } = await supabase
      .from('requirement_understanding')
      .select('version')
      .eq('requirement_id', input.requirementId)
      .order('version', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      version = existing[0].version + 1;
    }
  }

  const { data, error } = await supabase
    .from('requirement_understanding')
    .insert({
      requirement_id: input.requirementId ?? null,
      understanding: input.understanding,
      input_description: input.inputDescription,
      input_tech_category: input.inputTechCategory ?? null,
      user_id: user.id,
      version,
    })
    .select()
    .single();

  if (error) throw new ApiError(error.message, parseInt(error.code), error);
  return data as RequirementUnderstandingRow;
}

export async function getLatestRequirementUnderstanding(
  requirementId: string
): Promise<RequirementUnderstandingRow | null> {
  const { data, error } = await supabase
    .from('requirement_understanding')
    .select('*')
    .eq('requirement_id', requirementId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new ApiError(error.message, parseInt(error.code), error);
  if (!data || data.length === 0) return null;
  return data[0] as RequirementUnderstandingRow;
}

// ── Impact Map persistence ──

export interface SaveImpactMapInput {
  requirementId?: string;
  impactMap: Record<string, unknown>;
  inputDescription: string;
  inputTechCategory?: string;
  hasRequirementUnderstanding: boolean;
}

export async function saveImpactMap(
  input: SaveImpactMapInput
): Promise<ImpactMapRow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError('Utente non autenticato', 401);

  // Determine version: max existing version + 1
  let version = 1;
  if (input.requirementId) {
    const { data: existing } = await supabase
      .from('impact_map')
      .select('version')
      .eq('requirement_id', input.requirementId)
      .order('version', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      version = existing[0].version + 1;
    }
  }

  const { data, error } = await supabase
    .from('impact_map')
    .insert({
      requirement_id: input.requirementId ?? null,
      impact_map: input.impactMap,
      input_description: input.inputDescription,
      input_tech_category: input.inputTechCategory ?? null,
      has_requirement_understanding: input.hasRequirementUnderstanding,
      user_id: user.id,
      version,
    })
    .select()
    .single();

  if (error) throw new ApiError(error.message, parseInt(error.code), error);
  return data as ImpactMapRow;
}

export async function getLatestImpactMap(
  requirementId: string
): Promise<ImpactMapRow | null> {
  const { data, error } = await supabase
    .from('impact_map')
    .select('*')
    .eq('requirement_id', requirementId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new ApiError(error.message, parseInt(error.code), error);
  if (!data || data.length === 0) return null;
  return data[0] as ImpactMapRow;
}

// ── Estimation Blueprint persistence ──

export interface SaveEstimationBlueprintInput {
  requirementId?: string;
  blueprint: Record<string, unknown>;
  inputDescription: string;
  inputTechCategory?: string;
  basedOnUnderstandingId?: string;
  basedOnImpactMapId?: string;
  confidenceScore?: number;
}

export async function saveEstimationBlueprint(
  input: SaveEstimationBlueprintInput
): Promise<EstimationBlueprintRow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError('Utente non autenticato', 401);

  // Determine version: max existing version + 1
  let version = 1;
  if (input.requirementId) {
    const { data: existing } = await supabase
      .from('estimation_blueprint')
      .select('version')
      .eq('requirement_id', input.requirementId)
      .order('version', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      version = existing[0].version + 1;
    }
  }

  const { data, error } = await supabase
    .from('estimation_blueprint')
    .insert({
      requirement_id: input.requirementId ?? null,
      blueprint: input.blueprint,
      input_description: input.inputDescription,
      input_tech_category: input.inputTechCategory ?? null,
      based_on_understanding_id: input.basedOnUnderstandingId ?? null,
      based_on_impact_map_id: input.basedOnImpactMapId ?? null,
      confidence_score: input.confidenceScore ?? null,
      user_id: user.id,
      version,
    })
    .select()
    .single();

  if (error) throw new ApiError(error.message, parseInt(error.code), error);
  return data as EstimationBlueprintRow;
}

export async function getLatestEstimationBlueprint(
  requirementId: string
): Promise<EstimationBlueprintRow | null> {
  const { data, error } = await supabase
    .from('estimation_blueprint')
    .select('*')
    .eq('requirement_id', requirementId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new ApiError(error.message, parseInt(error.code), error);
  if (!data || data.length === 0) return null;
  return data[0] as EstimationBlueprintRow;
}

// ── Candidate Set (provenance debug) ──

export interface CandidateSetWithProvenance {
  id: string;
  analysis_id: string;
  candidates: Array<{
    activity_code: string;
    source: string;
    score: number;
    confidence: number;
    reason?: string;
  }>;
  created_at: string;
}

/**
 * Fetch the latest candidate set for a requirement (via requirement_analyses).
 * Returns null if no candidate set exists.
 */
export async function getLatestCandidateSet(
  requirementId: string
): Promise<CandidateSetWithProvenance | null> {
  // Step 1: find latest analysis for this requirement
  const { data: analyses, error: analysisErr } = await supabase
    .from('requirement_analyses')
    .select('id')
    .eq('requirement_id', requirementId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (analysisErr || !analyses || analyses.length === 0) return null;

  // Step 2: find latest candidate set for this analysis
  const { data: sets, error: setErr } = await supabase
    .from('candidate_sets')
    .select('id, analysis_id, candidates, created_at')
    .eq('analysis_id', analyses[0].id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (setErr || !sets || sets.length === 0) return null;
  return sets[0] as CandidateSetWithProvenance;
}
