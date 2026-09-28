import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Activity, ActivityState } from '../types';
import { Header } from '../components/Header';
import { ActivityEngine } from '../components/ActivityEngine';

import { getCachedActivityById, fetchActivityById } from '../services/content';
import { getDepartmentVariants } from '../utils/department';


export const ActivityRunnerPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { rosterUser } = useAuth();
  const departmentId = rosterUser?.department || '';

  const initialCached = activityId ? getCachedActivityById(activityId) || null : null;
  const [activity, setActivity] = useState<Activity | null>(initialCached);
  const [activityState, setActivityState] = useState<ActivityState | null>(null);
  const [loading, setLoading] = useState<boolean>(!initialCached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activityId) return;

    let unsubState: (() => void) | null = null;
    let isMounted = true;

    async function loadActivityData() {
      // If not yet in cache, show loading
      if (!initialCached) {
        setLoading(true);
      }
      setError(null);

      try {
        const actData = await fetchActivityById(activityId!);
        if (!actData) {
          if (isMounted) setError(`Activity "${activityId}" not found in database.`);
          if (isMounted) setLoading(false);
          return;
        }

        if (isMounted) {
          setActivity(actData);
          setLoading(false);
        }

        // Listen live to activityState for this department and its variants
        if (departmentId) {
          const variants = getDepartmentVariants(departmentId);
          const stateSnapMap = new Map<string, ActivityState | null>();
          const unsubs: (() => void)[] = [];

          const resolveState = () => {
            if (!isMounted) return;
            // Prefer an explicitly enabled state record
            let chosen: ActivityState | null = null;
            for (const st of stateSnapMap.values()) {
              if (st && st.enabled) {
                chosen = st;
                break;
              }
            }
            // Fallback to any existing state record if none is enabled
            if (!chosen) {
              for (const st of stateSnapMap.values()) {
                if (st) {
                  chosen = st;
                  break;
                }
              }
            }
            setActivityState(chosen);
            setLoading(false);
          };

          for (const v of variants) {
            const stateId = `${v}__${activityId}`;
            const stateRef = doc(db, 'activityState', stateId);

            const u = onSnapshot(
              stateRef,
              (snap) => {
                if (!isMounted) return;
                stateSnapMap.set(v, snap.exists() ? (snap.data() as ActivityState) : null);
                resolveState();
              },
              (_err) => {
                stateSnapMap.set(v, null);
                resolveState();
              }
            );
            unsubs.push(u);
          }

          unsubState = () => {
            unsubs.forEach((fn) => fn());
          };
        } else {
          if (isMounted) setLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to load activity:', err);
        if (isMounted) {
          setError(err.message || 'Error loading activity.');
          setLoading(false);
        }
      }
    }

    loadActivityData();

    return () => {
      isMounted = false;
      if (unsubState) unsubState();
    };
  }, [activityId, departmentId]);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading && (
          <div className="flex flex-col items-center justify-center p-12 space-y-3">
            <div className="w-10 h-10 border-4 border-christ-navy border-t-christ-gold rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-medium">
              Loading activity and workspace...
            </p>
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-red-200 text-center space-y-4">
            <span className="text-3xl block">⚠️</span>
            <h3 className="text-lg font-bold text-slate-900">Activity Error</h3>
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => navigate('/participant')}
              className="px-4 py-2 bg-christ-navy text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
            >
              Return to Participant Home
            </button>
          </div>
        )}

        {!loading && !error && activity && (
          <ActivityEngine
            activity={activity}
            activityState={activityState}
            onBack={() => navigate('/participant')}
          />
        )}
      </main>
    </div>
  );
};
