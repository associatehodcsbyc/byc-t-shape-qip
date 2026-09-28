import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { toDepartmentId } from '../utils/department';
import { RosterRowValidation, Role, AdminType } from '../types';

interface RosterUploadProps {
  existingEmails: Set<string>;
  existingDeptIds: Set<string>;
  onUploadSuccess: () => void;
}

export const RosterUpload: React.FC<RosterUploadProps> = ({
  existingEmails,
  existingDeptIds,
  onUploadSuccess,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<RosterRowValidation[]>([]);
  const [duplicateHandling, setDuplicateHandling] = useState<'update' | 'skip'>('update');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState<number>(0);
  const [commitStatus, setCommitStatus] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validateRow = (
    raw: Record<string, any>,
    index: number,
    seenInFile: Set<string>
  ): RosterRowValidation => {
    // Normalize keys
    const getVal = (possibleKeys: string[]) => {
      for (const k of possibleKeys) {
        const foundKey = Object.keys(raw).find(
          key => key.trim().toLowerCase() === k.toLowerCase()
        );
        if (foundKey && raw[foundKey] !== undefined) {
          return String(raw[foundKey]).trim();
        }
      }
      return '';
    };

    const rawName = getVal(['Name', 'name', 'Full Name']);
    const rawDepartment = getVal(['Department', 'department', 'Dept']);
    const rawEmail = getVal(['Email ID', 'email id', 'Email', 'email', 'Email Address']);
    const rawRole = getVal(['Role', 'role']);
    const rawAdminType = getVal(['Admin Type', 'admin type', 'AdminType']);

    const errors: string[] = [];

    // 1. Email validation: lowercase, trim, CHRIST domain
    const email = rawEmail.toLowerCase().trim();
    if (!email) {
      errors.push('Email is required');
    } else if (!email.match(/^[a-z0-9._%+-]+@christuniversity\.in$/)) {
      errors.push('Must be a valid @christuniversity.in email');
    }

    // Duplicate check in file
    let isDuplicateInFile = false;
    if (email) {
      if (seenInFile.has(email)) {
        isDuplicateInFile = true;
        errors.push('Duplicate email within file');
      } else {
        seenInFile.add(email);
      }
    }

    // 2. Name validation
    const name = rawName.trim();
    if (!name) {
      errors.push('Name is required');
    }

    // 3. Department validation
    const department = rawDepartment.trim();
    const departmentId = toDepartmentId(department);
    if (!department) {
      errors.push('Department is required');
    }

    // 4. Role validation
    let role: Role | null = null;
    const roleLower = rawRole.toLowerCase().trim();
    if (roleLower === 'participant') role = 'participant';
    else if (roleLower === 'hod') role = 'hod';
    else if (
      roleLower === 'coordinator' ||
      roleLower === 'qip coordinator' ||
      roleLower === 'qip_coordinator' ||
      roleLower === 'qip-coordinator'
    ) role = 'coordinator';
    else if (
      roleLower === 'resource_person' ||
      roleLower === 'resource person' ||
      roleLower === 'resource-person' ||
      roleLower === 'facilitator'
    ) role = 'resource_person';
    else if (roleLower === 'admin') role = 'admin';
    else {
      errors.push('Role must be Participant, HoD, QIP Coordinator, Resource Person, or Admin');
    }

    // 5. Admin Type validation
    let adminType: AdminType | null = null;
    const adminTypeLower = rawAdminType.toLowerCase().trim().replace(/[-\s]+/g, '_');
    if (role === 'admin') {
      if (adminTypeLower === 'app_admin' || adminTypeLower === 'appadmin') adminType = 'app_admin';
      else if (adminTypeLower === 'dean') adminType = 'dean';
      else if (adminTypeLower === 'associate_dean' || adminTypeLower === 'associatedean') adminType = 'associate_dean';
      else if (adminTypeLower === 'hrdc') adminType = 'hrdc';
      else {
        errors.push('Admin Type required for Admin: App Admin, Dean, Associate Dean, or HRDC');
      }
    } else {
      adminType = null;
    }

    const isExistingInDb = existingEmails.has(email);
    let status: 'valid' | 'error' | 'existing' = 'valid';
    if (errors.length > 0) {
      status = 'error';
    } else if (isExistingInDb) {
      status = 'existing';
    }

    return {
      rowNumber: index + 1,
      rawName,
      rawDepartment,
      rawEmail,
      rawRole,
      rawAdminType,
      name,
      department,
      departmentId,
      email,
      role,
      adminType,
      status,
      errors,
      isDuplicateInFile,
      isExistingInDb,
      action: duplicateHandling,
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setSuccessMessage(null);
    setCommitStatus(null);

    const isCsv = file.name.endsWith('.csv');
    const seenInFile = new Set<string>();

    if (isCsv) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const validated = results.data.map((row: any, i: number) =>
            validateRow(row, i, seenInFile)
          );
          setRows(validated);
        },
        error: (err) => {
          alert(`CSV parse error: ${err.message}`);
        },
      });
    } else {
      // Excel XLSX / XLS
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const XLSX = await import('xlsx');
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          const validated = data.map((row: any, i: number) =>
            validateRow(row, i, seenInFile)
          );
          setRows(validated);
        } catch (err: any) {
          alert(`Excel parse error: ${err.message}`);
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  // Identify new departments that will be created
  const newDepartments = Array.from(
    new Map(
      rows
        .filter(r => r.errors.length === 0 && r.departmentId && !existingDeptIds.has(r.departmentId))
        .map(r => [r.departmentId, r.department])
    ).entries()
  );

  const errorCount = rows.filter(r => r.status === 'error').length;
  const existingCount = rows.filter(r => r.status === 'existing').length;
  const validNewCount = rows.filter(r => r.status === 'valid').length;

  const canCommit = rows.length > 0 && errorCount === 0 && !isCommitting;

  const handleCommit = async () => {
    if (!canCommit) return;

    setIsCommitting(true);
    setCommitProgress(5);
    setCommitStatus('Preparing batched writes...');

    try {
      // Filter rows to commit based on duplicate handling
      const rowsToCommit = rows.filter(r => {
        if (r.errors.length > 0) return false;
        if (r.status === 'existing' && duplicateHandling === 'skip') return false;
        return true;
      });

      // Prepare operations: new departments + roster rows
      interface WriteOp {
        collection: string;
        id: string;
        data: Record<string, any>;
      }

      const operations: WriteOp[] = [];

      // 1. New departments
      for (const [deptId, deptName] of newDepartments) {
        operations.push({
          collection: 'departments',
          id: deptId,
          data: {
            name: deptName,
            campus: 'BYC',
          },
        });
      }

      // 2. Roster rows
      for (const r of rowsToCommit) {
        operations.push({
          collection: 'roster',
          id: r.email,
          data: {
            email: r.email,
            name: r.name,
            department: r.departmentId,
            role: r.role,
            adminType: r.adminType || null,
            active: true,
            uploadedBy: user?.email || 'appadmin@christuniversity.in',
            uploadedAt: serverTimestamp(),
          },
        });
      }

      // 3. Batched commit (max 500 per batch)
      const BATCH_SIZE = 450;
      const totalOps = operations.length;
      let committed = 0;

      for (let i = 0; i < totalOps; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = operations.slice(i, i + BATCH_SIZE);

        for (const op of chunk) {
          batch.set(doc(db, op.collection, op.id), op.data, { merge: true });
        }

        await batch.commit();
        committed += chunk.length;
        const progress = Math.min(95, Math.round((committed / totalOps) * 90) + 5);
        setCommitProgress(progress);
        setCommitStatus(`Committed ${committed} of ${totalOps} records...`);
      }

      // 4. One audit log entry per upload (per SPEC §3 & §5)
      const auditBatch = writeBatch(db);
      const auditRef = doc(collection(db, 'auditLog'));
      auditBatch.set(auditRef, {
        actor: user?.email || 'appadmin@christuniversity.in',
        action: 'roster_upload',
        target: 'roster',
        details: `Bulk uploaded ${rowsToCommit.length} users (${newDepartments.length} new departments created). Existing handled as: ${duplicateHandling}.`,
        at: serverTimestamp(),
      });
      await auditBatch.commit();

      setCommitProgress(100);
      setCommitStatus('Completed successfully!');
      setSuccessMessage(`Successfully uploaded ${rowsToCommit.length} roster entries and created ${newDepartments.length} new departments.`);
      setRows([]);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      onUploadSuccess();
    } catch (err: any) {
      console.error('Commit failed:', err);
      alert(`Commit failed: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const loadBadSample = () => {
    const csvContent = `Name,Department,Email ID,Role,Admin Type
Dr Valid Faculty,Computer Science,valid.cs@christuniversity.in,Participant,
Dr Invalid Faculty,Computer Science,invalid.user@gmail.com,Participant,`;
    setFileName('bad_roster.csv');
    setSuccessMessage(null);
    setCommitStatus(null);
    const seenInFile = new Set<string>();
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validated = results.data.map((row: any, i: number) =>
          validateRow(row, i, seenInFile)
        );
        setRows(validated);
      },
    });
  };

  const loadTemplateSample = () => {
    const csvContent = `Name,Department,Email ID,Role,Admin Type
Dr Balakrishnan C,Computer Science,balakrishnan.c@christuniversity.in,Participant,
Dr Vinay M,Computer Science,computer.science.byc@christuniversity.in,HoD,
Dr Balakrishnan C,HRDC,associatehod.cs.byc@christuniversity.in,Admin,App Admin
Dr Joby Thomas,BYC,dean.yeshwanthpur@christuniversity.in,Admin,Dean
Dr Raghunanthan G,BYC,associatedean.yeshwanthpur@christuniversity.in,Admin,Associate Dean`;
    setFileName('roster_template.csv');
    setSuccessMessage(null);
    setCommitStatus(null);
    const seenInFile = new Set<string>();
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validated = results.data.map((row: any, i: number) =>
          validateRow(row, i, seenInFile)
        );
        setRows(validated);
      },
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 mb-6 gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Bulk Roster Onboarding</h3>
          <p className="text-xs text-slate-500">
            Upload CSV or XLSX matching <code className="bg-slate-100 px-1 py-0.5 rounded text-christ-navy font-semibold">roster_template.csv</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {import.meta.env.VITE_USE_EMULATORS === 'true' && (
            <>
              <button
                type="button"
                onClick={loadBadSample}
                id="roster-load-bad-sample-btn"
                className="px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition shadow-sm"
              >
                🧪 Load Bad Row Sample
              </button>
              <button
                type="button"
                onClick={loadTemplateSample}
                id="roster-load-template-sample-btn"
                className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition shadow-sm"
              >
                🧪 Load Valid Template Sample
              </button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileUpload}
            id="roster-file-input"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            id="roster-select-file-btn"
            className="px-4 py-2 text-xs font-semibold text-white bg-christ-navy hover:bg-slate-800 rounded-lg shadow-sm transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Choose CSV / XLSX
          </button>
        </div>
      </div>

      {successMessage && (
        <div id="roster-upload-success" className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-3">
          <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium text-emerald-800">{successMessage}</p>
        </div>
      )}

      {fileName && (
        <div className="mb-4 flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Selected File:</span>
            <span className="font-mono text-christ-navy font-bold">{fileName}</span>
            <span className="text-slate-400">({rows.length} rows parsed)</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-700">For existing roster entries:</span>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="duplicateHandling"
                value="update"
                checked={duplicateHandling === 'update'}
                onChange={() => setDuplicateHandling('update')}
                className="text-christ-navy focus:ring-christ-navy"
              />
              <span>Update</span>
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="duplicateHandling"
                value="skip"
                checked={duplicateHandling === 'skip'}
                onChange={() => setDuplicateHandling('skip')}
                className="text-christ-navy focus:ring-christ-navy"
              />
              <span>Skip</span>
            </label>
          </div>
        </div>
      )}

      {/* Summary Chips */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-xs font-medium">
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">
            <span className="text-slate-500">Total Rows</span>
            <div className="text-lg font-bold text-slate-800">{rows.length}</div>
          </div>
          <div className="bg-emerald-50 p-2.5 rounded border border-emerald-200 text-center">
            <span className="text-emerald-700">Valid New</span>
            <div className="text-lg font-bold text-emerald-800">{validNewCount}</div>
          </div>
          <div className="bg-amber-50 p-2.5 rounded border border-amber-200 text-center">
            <span className="text-amber-700">Existing in Roster</span>
            <div className="text-lg font-bold text-amber-800">{existingCount}</div>
          </div>
          <div className={`p-2.5 rounded border text-center ${errorCount > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <span>Errors</span>
            <div className="text-lg font-bold">{errorCount}</div>
          </div>
        </div>
      )}

      {/* New Departments Notice */}
      {newDepartments.length > 0 && (
        <div id="new-departments-alert" className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
            <svg className="w-4 h-4 text-blue-700" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            New Departments Detected ({newDepartments.length})
          </h4>
          <p className="text-xs text-blue-800 mt-1">
            The following new departments will be automatically registered in the system upon commit:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {newDepartments.map(([id, name]) => (
              <span key={id} className="bg-white text-blue-900 px-2.5 py-1 rounded text-xs border border-blue-200 font-medium">
                {name} <span className="text-blue-500 font-mono text-[10px]">({id})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preview Table */}
      {rows.length > 0 && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg mb-4 max-h-80">
          <table id="roster-preview-table" className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 sticky top-0 font-semibold text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Department (Slug)</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Admin Type</th>
                <th className="px-3 py-2 text-left">Issues / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => {
                const isErr = row.status === 'error';
                const isExist = row.status === 'existing';
                return (
                  <tr key={row.rowNumber} className={isErr ? 'bg-red-50/70' : isExist ? 'bg-amber-50/40' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2 text-slate-400 font-mono">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-medium">
                      {isErr && <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded text-[10px] font-bold">Error</span>}
                      {isExist && <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[10px] font-bold">Existing</span>}
                      {!isErr && !isExist && <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold">Ready</span>}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{row.name || <span className="text-red-500 italic">Empty</span>}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.department} {row.departmentId && <span className="text-slate-400 font-mono text-[10px]">({row.departmentId})</span>}
                    </td>
                    <td className={`px-3 py-2 font-mono ${isErr && row.errors.some(e => e.includes('email')) ? 'text-red-700 font-bold underline' : 'text-slate-600'}`}>
                      {row.email || row.rawEmail}
                    </td>
                    <td className="px-3 py-2 capitalize">{row.role || <span className="text-red-500 italic">Invalid</span>}</td>
                    <td className="px-3 py-2">{row.adminType || '-'}</td>
                    <td className="px-3 py-2">
                      {isErr ? (
                        <span className="text-red-600 font-semibold">{row.errors.join(', ')}</span>
                      ) : isExist ? (
                        <span className="text-amber-700 font-medium">Will {duplicateHandling}</span>
                      ) : (
                        <span className="text-emerald-600 font-medium">Will create</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Progress Bar when committing */}
      {isCommitting && (
        <div className="mb-4">
          <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
            <span>{commitStatus}</span>
            <span>{commitProgress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-christ-navy h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${commitProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {rows.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500">
            {errorCount > 0 ? (
              <span className="text-red-600 font-semibold">
                ⚠️ Correct all errors in your file before committing to Firestore.
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold">
                ✓ All {rows.length} rows validated successfully. Ready to commit.
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setRows([]);
                setFileName(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              disabled={isCommitting}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCommit}
              disabled={!canCommit}
              id="roster-commit-btn"
              className={`px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-2 ${
                canCommit
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isCommitting ? 'Committing...' : `Commit ${rows.length} Rows to Roster`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
