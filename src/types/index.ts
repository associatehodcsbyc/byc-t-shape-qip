export type Role = 'participant' | 'hod' | 'coordinator' | 'admin';

export type AdminType = 'app_admin' | 'dean' | 'associate_dean' | 'hrdc';

export interface RosterUser {
  email: string;
  name: string;
  department: string; // normalized departmentId slug
  role: Role;
  adminType?: AdminType | null;
  active: boolean;
  uploadedBy?: string;
  uploadedAt?: any;
}

export interface Department {
  id: string;
  name: string;
  campus: 'BYC';
}

export interface AuditLogEntry {
  id?: string;
  actor: string;
  action: string;
  target: string;
  details: string | Record<string, any>;
  at: any;
}

export interface RosterRowValidation {
  rowNumber: number;
  rawName: string;
  rawDepartment: string;
  rawEmail: string;
  rawRole: string;
  rawAdminType: string;
  name: string;
  department: string;
  departmentId: string;
  email: string;
  role: Role | null;
  adminType: AdminType | null;
  status: 'valid' | 'error' | 'existing';
  errors: string[];
  isDuplicateInFile?: boolean;
  isExistingInDb?: boolean;
  action?: 'update' | 'skip';
}

// ============================================================================
// Phase 3: Sessions, Activities, Widgets and Responses
// ============================================================================

export interface Session {
  sessionId: string; // e.g. 'd1s1'
  day: 1 | 2 | 3;
  date: string; // '2026-09-28'
  slot: 'I' | 'II' | 'III' | 'IV';
  time: string; // '09:15-10:45'
  title: string;
  facilitator: string;
  order: number;
}

export type WidgetType =
  | 'composite'
  | 'rating_scale'
  | 'choice_matrix'
  | 'rank_order'
  | 'checklist'
  | 'table_entry'
  | 'free_text'
  | 'poll'
  | 'fixed_grid'
  | 'crm_matrix'
  | 'working_doc';

export interface ReflectionConfig {
  id: string;
  prompt: string;
  maxChars?: number;
}

export interface ScoreBand {
  min: number;
  max: number;
  label: string;
  description?: string;
}

export interface ScoringConfig {
  method: 'sum';
  max?: number;
  bands?: ScoreBand[];
}

export interface CarryForwardConfig {
  readKeys?: string[];
  writeKeys?: string[];
  writeFrom?: Record<string, string>;
}

export interface RatingScaleSection {
  id: string;
  title: string;
  items: {
    id: string;
    text: string;
  }[];
}

export interface RatingScaleConfig {
  scale: {
    min: number;
    max: number;
    labels: string[];
  };
  sections?: RatingScaleSection[];
  items?: { id: string; text: string }[];
  evidence?: boolean;
  reflections?: ReflectionConfig[];
}

export interface ChoiceMatrixConfig {
  options: string[];
  items: {
    id: string;
    text: string;
  }[];
  evidence?: boolean;
  reflections?: ReflectionConfig[];
}

export interface RankOrderConfig {
  options: {
    id: string;
    text: string;
  }[];
  reflections?: ReflectionConfig[];
}

export interface ChecklistConfig {
  options: {
    id: string;
    text: string;
  }[];
  allowOther?: boolean;
  reflections?: ReflectionConfig[];
}

export interface TableColumnConfig {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select';
  min?: number;
  max?: number;
  options?: string[];
}

export type TableComputedConfig =
  | {
      type: 'ratio_by_category';
      valueColumn: string;
      categoryColumn: string;
      target: string;
    }
  | {
      type: 'sum';
      column: string;
      expect?: number;
    }
  | {
      type: 'row_sum';
      columns: string[];
      label?: string;
    };

export interface TableEntryConfig {
  columns: TableColumnConfig[];
  minRows?: number;
  maxRows?: number;
  computed?: TableComputedConfig;
  reflections?: ReflectionConfig[];
}

export interface FreeTextQuestion {
  id: string;
  prompt: string;
  maxChars?: number;
}

export interface FreeTextConfig {
  questions: FreeTextQuestion[];
  reflections?: ReflectionConfig[];
}

export interface PollQuestion {
  id: string;
  prompt: string;
  multi: boolean;
  options: {
    id: string;
    text: string;
  }[];
}

export interface PollConfig {
  questions: PollQuestion[];
  reflections?: ReflectionConfig[];
}

export interface CompositePart {
  id: string;
  widgetType: WidgetType;
  label?: string;
  instructions?: string;
  config: any;
}

export interface CompositeConfig {
  context?: string;
  parts: CompositePart[];
  reflections?: ReflectionConfig[];
}

export interface Activity {
  activityId: string; // e.g. 'd1s1_a1_four_pillars'
  sessionId: string;  // e.g. 'd1s1'
  order: number;
  title: string;
  instructions: string;
  sourceRef: string;
  widgetType: WidgetType;
  config: any;
  groupMode: 'individual' | 'group';
  groupSetup?: string;
  confidential: boolean;
  derived: boolean;
  timeLimitMin?: number;
  carryForward?: CarryForwardConfig;
  scoring?: ScoringConfig;
}

export interface ActivityState {
  department: string;
  activityId: string;
  sessionId: string;
  enabled: boolean;
  locked: boolean;
  updatedBy: string;
  updatedAt: any;
}

export interface ActivityResponse {
  activityId: string;
  sessionId: string;
  department: string;
  email: string;
  uid: string;
  name: string;
  answers: Record<string, any>;
  status: 'draft' | 'submitted';
  groupLabel?: string;
  confidential: boolean;
  createdAt: any;
  updatedAt: any;
  submittedAt?: any;
}

export interface SubmissionProgress {
  activityId: string;
  sessionId: string;
  department: string;
  email: string;
  name: string;
  status: 'draft' | 'submitted';
  groupLabel?: string;
  updatedAt: any;
}

export interface WorkingDoc {
  email: string;
  department: string;
  fields: Record<string, any>;
  updatedAt: any;
}

export interface AppConfig {
  groupProtocol: string;
  groupLabels: string[];
  updatedAt?: any;
}

export interface ItemStat {
  mean: number;
  sd: number;
  dist: number[]; // [count1, count2, count3, count4, count5]
}

export interface SectionStat {
  mean: number;
  sd: number;
}

export interface ActivitySummary {
  department: string;
  activityId: string;
  n: number;
  itemStats?: Record<string, ItemStat>;
  sectionStats?: Record<string, SectionStat>;
  totalStats?: { mean: number; sd: number };
  bandCounts?: Record<string, number>;
  comments?: string[];
  suppressed: boolean;
  updatedAt: any;
}
