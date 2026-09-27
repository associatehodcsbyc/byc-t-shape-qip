import { describe, it, expect } from 'vitest';
import {
  validateDepartmentInput,
  validateFacultyInput,
  NewFacultyInput,
} from '../src/services/departmentRosterService';

describe('Department and Faculty Single-Entry Validation', () => {
  describe('validateDepartmentInput', () => {
    it('rejects empty department name', () => {
      const res = validateDepartmentInput('');
      expect(res.valid).toBe(false);
      expect(res.errors.name).toBeDefined();
    });

    it('rejects short department name', () => {
      const res = validateDepartmentInput('A');
      expect(res.valid).toBe(false);
      expect(res.errors.name).toContain('at least 2 characters');
    });

    it('rejects department name with only symbols', () => {
      const res = validateDepartmentInput('---!!!');
      expect(res.valid).toBe(false);
      expect(res.errors.name).toContain('alphanumeric');
    });

    it('accepts valid department names and formats', () => {
      const res = validateDepartmentInput('Department of Computer Science & Engineering');
      expect(res.valid).toBe(true);
      expect(Object.keys(res.errors).length).toBe(0);
    });
  });

  describe('validateFacultyInput', () => {
    const validBase: NewFacultyInput = {
      name: 'Dr. Jane Doe',
      email: 'jane.doe@christuniversity.in',
      departmentId: 'computer-science',
      role: 'participant',
    };

    it('accepts valid participant faculty', () => {
      const res = validateFacultyInput(validBase);
      expect(res.valid).toBe(true);
      expect(Object.keys(res.errors).length).toBe(0);
    });

    it('rejects missing or short name', () => {
      const res1 = validateFacultyInput({ ...validBase, name: '' });
      expect(res1.valid).toBe(false);
      expect(res1.errors.name).toBeDefined();

      const res2 = validateFacultyInput({ ...validBase, name: 'A' });
      expect(res2.valid).toBe(false);
      expect(res2.errors.name).toContain('at least 2 characters');
    });

    it('rejects non-CHRIST email domain', () => {
      const res = validateFacultyInput({
        ...validBase,
        email: 'jane.doe@gmail.com',
      });
      expect(res.valid).toBe(false);
      expect(res.errors.email).toContain('@christuniversity.in');
    });

    it('rejects missing department', () => {
      const res = validateFacultyInput({
        ...validBase,
        departmentId: '',
      });
      expect(res.valid).toBe(false);
      expect(res.errors.departmentId).toBeDefined();
    });

    it('requires Admin Type when role is Admin', () => {
      const res = validateFacultyInput({
        ...validBase,
        role: 'admin',
        adminType: undefined,
      });
      expect(res.valid).toBe(false);
      expect(res.errors.adminType).toContain('Admin Type is required');
    });

    it('accepts valid admin with App Admin type', () => {
      const res = validateFacultyInput({
        ...validBase,
        role: 'admin',
        adminType: 'app_admin',
      });
      expect(res.valid).toBe(true);
      expect(Object.keys(res.errors).length).toBe(0);
    });

    it('accepts valid HoD without admin type', () => {
      const res = validateFacultyInput({
        ...validBase,
        role: 'hod',
      });
      expect(res.valid).toBe(true);
    });

    it('accepts valid QIP Coordinator without admin type', () => {
      const res = validateFacultyInput({
        ...validBase,
        role: 'coordinator',
      });
      expect(res.valid).toBe(true);
      expect(Object.keys(res.errors).length).toBe(0);
    });
  });
});
