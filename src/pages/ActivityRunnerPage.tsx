import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Activity, ActivityState } from '../types';
import { Header } from '../components/Header';
import { ActivityEngine } from '../components/ActivityEngine';

export const ActivityRunnerPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { rosterUser } = useAuth();
  const departmentId = rosterUser?.department || '';

  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityState, setActivityState] = useState<ActivityState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activityId) return;

    let unsubState: (() => void) | null = null;

    async function fetchActivity() {
      setLoading(true);
      setError(null);

      try {
        const actRef = doc(db, 'activities', activityId!);
        const actSnap = await getDoc(actRef);

        if (!actSnap.exists()) {
          setError(`Activity "${activityId}" not found in database.`);
          setLoading(false);
          return;
        }

        const actData = actSnap.data() as Activity;
        setActivity(actData);

        // Listen live to activityState for this department
        if (departmentId) {
          const stateId = `${departmentId}__${activityId}`;
          const stateRef = doc(db, 'activityState', stateId);

          unsubState = onSnapshot(
            stateRef,
            (snap) => {
              if (snap.exists()) {
                setActivityState(snap.data() as ActivityState);
              } else {
                setActivityState(null);
              }
              setLoading(false);
            },
            (err) => {
              console.error('Error listening to activityState:', err);
              setLoading(false);
            }
          );
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to load activity:', err);
        setError(err.message || 'Error loading activity.');
        setLoading(false);
      }
    }

    fetchActivity();

    return () => {
      if (unsubState) unsubState();
    };
  }, [activityId, departmentId]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
