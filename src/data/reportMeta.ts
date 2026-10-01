import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface PhotoEntry {
  storagePath: string;
  downloadURL: string;
  caption: string;
  uploadedBy: string;
  uploadedAt: number;
}

export interface AttendanceEntry {
  storagePath: string;
  downloadURL: string;
  caption: string;
  uploadedBy: string;
  uploadedAt: number;
}

export interface ReportHeader {
  theme?: string;
  titleOverride?: string;
  datesOverride?: string;
  department?: string;
  facultyInDept?: string;
  facultyAttended?: string;
  coordinatorName?: string;
  coordinatorContact?: string;
  venue?: string;
  submissionDate?: string;
}

export interface SessionFields {
  resourcePerson?: string;
  summaryOfProceedings?: string;
  inferences?: string;
}

export interface ActionPlanRow {
  action: string;
  rationale: string;
  personResponsible: string;
  timeline: string;
}

export interface ReportSignatures {
  coordinatorName?: string;
  hodName?: string;
}

export interface ReportFields {
  header?: ReportHeader;
  sessions?: Record<string, SessionFields>;
  activityInferences?: Record<string, string>;
  actionPlanExtra?: ActionPlanRow[];
  photosNote?: string;
  hodObservations?: string;
  signatures?: ReportSignatures;
  photos?: PhotoEntry[];
  attendance?: AttendanceEntry[];
  [key: string]: any;
}

export interface ReportMeta {
  fields: ReportFields;
  updatedBy: string;
  updatedAt: any;
}

export const getReportMetaRef = (deptId?: string) => {
  const docId = deptId && deptId.trim() ? `main_${deptId.trim()}` : 'main';
  return doc(db, 'reportMeta', docId);
};

export const getReportMeta = async (deptId?: string): Promise<ReportMeta | null> => {
  const snap = await getDoc(getReportMetaRef(deptId));
  return snap.exists() ? (snap.data() as ReportMeta) : null;
};

export const updateReportMetaFields = async (
  fieldsUpdate: Partial<ReportFields>,
  email: string,
  deptId?: string
) => {
  const ref = getReportMetaRef(deptId);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data() as ReportMeta) : { fields: {} };

  await setDoc(ref, {
    fields: { ...current.fields, ...fieldsUpdate },
    updatedBy: email,
    updatedAt: serverTimestamp(),
  });
};
