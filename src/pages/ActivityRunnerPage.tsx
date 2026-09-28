import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, ActivityState } from '../types';
import { Header } from '../components/Header';
import { ActivityEngine } from '../components/ActivityEngine';

import { getCachedActivityById, fetchActivityById } from '../services/content';
import { subscribeToDepartmentActivityStates } from '../services/activityState';


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

        // Listen live to activityState using resilient department matching and 'all' gate
        if (departmentId) {
          unsubState = subscribeToDepartmentActivityStates(departmentId, (map) => {
            if (!isMounted) return;
            const st = map.get(activityId!);
            setActivityState(st || null);
            setLoading(false);
          });
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
