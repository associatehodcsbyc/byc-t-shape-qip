import { doc, getDoc, collection, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { toDepartmentId } from '../utils/department';
import { Role, AdminType, Department, RosterUser } from '../types';

export interface NewFacultyInput {
  name: string;
  email: string;
  departmentId: string;
  role: Role;
  adminType?: AdminType | null;
  active?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate single department creation input.
 */
export function validateDepartmentInput(name: string): ValidationResult {
  const errors: Record<string, string> = {};
  const trimmed = name?.trim() || '';

  if (!trimmed) {
    errors.name = 'Department name is required.';
  } else if (trimmed.length < 2) {
    errors.name = 'Department name must be at least 2 characters.';
  } else {
    const slug = toDepartmentId(trimmed);
    if (!slug) {
      errors.name = 'Department name must contain alphanumeric characters.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate single faculty creation/update input.
 */
export function validateFacultyInput(input: NewFacultyInput): ValidationResult {
  const errors: Record<string, string> = {};

  const name = input?.name?.trim() || '';
  if (!name) {
    errors.name = 'Full name is required.';
  } else if (name.length < 2) {
    errors.name = 'Name must be at least 2 characters.';
  }

  const email = input?.email?.trim().toLowerCase() || '';
  if (!email) {
    errors.email = 'Email address is required.';
  } else if (!email.match(/^[a-z0-9._%+-]+@christuniversity\.in$/)) {
    errors.email = 'Must be a valid @christuniversity.in institutional email.';
  }

  if (!input?.departmentId?.trim()) {
    errors.departmentId = 'Department is required.';
  }

  if (!input?.role) {
    errors.role = 'Role is required.';
  } else if (!['participant', 'hod', 'coordinator', 'resource_person', 'admin'].includes(input.role)) {
    errors.role = 'Role must be Participant, HoD, QIP Coordinator, Resource Person, or Admin.';
  }

  if (input?.role === 'admin') {
    if (!input.adminType) {
      errors.adminType = 'Admin Type is required for Admin role.';
    } else if (!['app_admin', 'dean', 'associate_dean', 'hrdc'].includes(input.adminType)) {
      errors.adminType = 'Admin Type must be App Admin, Dean, Associate Dean, or HRDC.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Check if a department with the given slug already exists in Firestore.
 */
export async function checkDepartmentExists(departmentId: string): Promise<boolean> {
  if (!departmentId) return false;
  const docRef = doc(db, 'departments', departmentId);
  const snap = await getDoc(docRef);
  return snap.exists();
}

/**
 * Check if a faculty email already exists in Firestore roster.
 */
export async function checkFacultyExists(email: string): Promise<RosterUser | null> {
  const emailLower = email.trim().toLowerCase();
  if (!emailLower) return null;
  const docRef = doc(db, 'roster', emailLower);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as RosterUser;
}

/**
 * Create a new department with audit log.
 */
export async function insertSingleDepartment(
  name: string,
  actorEmail: string
): Promise<Department> {
  const validation = validateDepartmentInput(name);
  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0];
    throw new Error(firstErr);
  }

  const trimmedName = name.trim();
  const departmentId = toDepartmentId(trimmedName);

  const exists = await checkDepartmentExists(departmentId);
  if (exists) {
    throw new Error(`Department "${trimmedName}" (${departmentId}) already exists.`);
  }

  const batch = writeBatch(db);

  // 1. Department document
  const deptRef = doc(db, 'departments', departmentId);
  batch.set(deptRef, {
    name: trimmedName,
    campus: 'BYC',
  });

  const effectiveActor = (auth.currentUser?.email || actorEmail || '').toLowerCase().trim();

  // 2. Audit log entry
  const auditRef = doc(collection(db, 'auditLog'));
  batch.set(auditRef, {
    actor: effectiveActor,
    action: 'department_create',
    target: 'departments',
    details: `Single entry added: ${trimmedName} (${departmentId}) for BYC campus.`,
    at: serverTimestamp(),
  });

  await batch.commit();

  return {
    id: departmentId,
    name: trimmedName,
    campus: 'BYC',
  };
}

/**
 * Insert or update a single faculty member in roster with audit log.
 */
export async function insertSingleFaculty(
  input: NewFacultyInput,
  actorEmail?: string,
  options?: { allowUpdate?: boolean }
): Promise<RosterUser> {
  const validation = validateFacultyInput(input);
  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0];
    throw new Error(firstErr);
  }

  const emailLower = input.email.trim().toLowerCase();
  const cleanName = input.name.trim();
  const cleanDeptId = input.departmentId.trim();
  const active = input.active !== undefined ? input.active : true;
  const adminType = input.role === 'admin' ? (input.adminType || null) : null;
  const effectiveActor = (auth.currentUser?.email || actorEmail || '').toLowerCase().trim();

  const existing = await checkFacultyExists(emailLower);
  const isUpdate = !!existing;

  if (isUpdate && !options?.allowUpdate) {
    const err: any = new Error(`Faculty with email "${emailLower}" already exists in roster.`);
    err.code = 'FACULTY_EXISTS';
    err.existing = existing;
    throw err;
  }

  const batch = writeBatch(db);

  // 1. Roster document
  const rosterRef = doc(db, 'roster', emailLower);
  const rosterPayload = {
    email: emailLower,
    name: cleanName,
    department: cleanDeptId,
    role: input.role,
    adminType: adminType,
    active: active,
    uploadedBy: effectiveActor,
    uploadedAt: serverTimestamp(),
  };

  batch.set(rosterRef, rosterPayload, { merge: true });

  // 2. Audit log entry
  const auditRef = doc(collection(db, 'auditLog'));
  batch.set(auditRef, {
    actor: effectiveActor,
    action: isUpdate ? 'roster_update_single' : 'roster_create_single',
    target: 'roster',
    details: `Single entry ${isUpdate ? 'updated' : 'created'}: ${cleanName} (${emailLower}), Dept: ${cleanDeptId}, Role: ${input.role}${adminType ? ' (' + adminType + ')' : ''}.`,
    at: serverTimestamp(),
  });

  await batch.commit();

  return {
    email: emailLower,
    name: cleanName,
    department: cleanDeptId,
    role: input.role,
    adminType: adminType,
    active: active,
    uploadedBy: actorEmail,
  };
}
