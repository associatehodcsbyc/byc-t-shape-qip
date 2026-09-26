export type Role = 'participant' | 'hod' | 'admin';

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
  details: string;
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
