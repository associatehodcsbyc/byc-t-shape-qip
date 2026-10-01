import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { CompositeWidget } from '../components/widgets/CompositeWidget';
import { useAuth } from '../context/AuthContext';
import { getMyFeedback, saveFeedbackDraft, submitFeedback } from '../data/feedback';
import { feedbackActivity, feedbackFormContent } from '../data/feedbackForm';

export const FeedbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { rosterUser } = useAuth();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Keep ref of latest answers for debounced save
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing feedback document on mount
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const doc = await getMyFeedback();
        if (doc && isMounted) {
          if (doc.answers) {
            setAnswers(doc.answers);
          }
          if (doc.status === 'submitted') {
            setIsSubmitted(true);
          }
        }
      } catch (err) {
        console.error('Failed to load feedback:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // 8-second debounce draft autosave
  const triggerAutoSave = useCallback(
    async (currentAnswers: Record<string, any>) => {
      if (isSubmitted || !rosterUser) return;
      setSaveStatus('saving');
      try {
        await saveFeedbackDraft(currentAnswers, {
          email: rosterUser.email,
          name: rosterUser.name,
          department: rosterUser.department,
          role: rosterUser.role,
        });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Draft autosave failed:', err);
        setSaveStatus('error');
      }
    },
    [isSubmitted, rosterUser]
  );

  // Listen to answer changes
  const handleAnswersChange = (updatedAnswers: Record<string, any>) => {
    if (isSubmitted) return;
    setAnswers(updatedAnswers);
    setSaveStatus('dirty');
    setValidationError(null);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 8 seconds debounce
    saveTimeoutRef.current = setTimeout(() => {
      triggerAutoSave(updatedAnswers);
    }, 8000);
  };

  // Flush save on unmount if dirty
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Validate all required parts before submission
  const validateForm = (): string | null => {
    // 1. Part A: Rating scale (a1..a5)
    const pA = answers.pA || {};
    const missingA = ['a1', 'a2', 'a3', 'a4', 'a5'].filter((k) => !pA[k]);
    if (missingA.length > 0) {
      return 'Please rate all 5 statements in Section A (T-Shaped Learning & Curriculum Direction).';
    }

    // 2. Part B: Choice matrix (b1..b5)
    const pB = answers.pB || {};
    const missingB = ['b1', 'b2', 'b3', 'b4', 'b5'].filter((k) => !pB[k]);
    if (missingB.length > 0) {
      return 'Please evaluate all 5 areas in Section B (Programme Delivery & Facilitation).';
    }

    // 3. Part C1: Poll
    const pC1 = answers.pC1;
    if (!pC1 || (typeof pC1 === 'object' && !pC1.selected && !pC1.optionId && Object.keys(pC1).length === 0)) {
      return 'Please select an option in Section C (Poll on assessment design).';
    }

    // 4. Part C2: Rating scale (c2)
    const pC2 = answers.pC2 || {};
    if (!pC2.c2) {
      return 'Please rate statement C2 regarding applying assessment ideas.';
    }

    // 5. Part D1: Checklist
    const pD1 = answers.pD1;
    const hasChecked =
      pD1 &&
      (Array.isArray(pD1)
        ? pD1.length > 0
        : typeof pD1 === 'object'
        ? Object.values(pD1).some(Boolean)
        : false);
    if (!hasChecked) {
      return 'Please select at least one element in Section D (Which elements worked best for you).';
    }

    return null;
  };

  const handleSubmit = async () => {
    if (isSubmitted || !rosterUser) return;

    // Clear any pending draft timer
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const err = validateForm();
    if (err) {
      setValidationError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    setValidationError(null);

    try {
      await submitFeedback(answers, {
        email: rosterUser.email,
        name: rosterUser.name,
        department: rosterUser.department,
        role: rosterUser.role,
      });
      setIsSubmitted(true);
      setSaveStatus('saved');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Submit feedback failed:', err);
      setValidationError(err.message || 'Submission failed. Please check your network connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabel = rosterUser?.role
    ? rosterUser.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Participant';

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Breadcrumb / Back button */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
          >
            ← Back to Dashboard
          </button>

          {/* Autosave Status Indicator */}
          {!isSubmitted && (
            <div className="flex items-center gap-2 text-xs font-medium">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1.5 text-amber-600 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Saving draft...
                </span>
              )}
              {saveStatus === 'dirty' && (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  Autosaving in 8s...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Draft saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-red-600">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Save error
                </span>
              )}
            </div>
          )}
        </div>

        {/* Title Header Card */}
        <div className="bg-gradient-to-r from-slate-900 via-christ-navy to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-christ-gold/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-christ-gold/20 text-christ-gold rounded-full text-xs font-bold uppercase tracking-wider border border-christ-gold/30">
                Official HRDC Feedback
              </span>
              <span className="px-3 py-1 bg-white/10 text-white/90 rounded-full text-xs font-medium">
                {roleLabel} • {rosterUser?.department?.toUpperCase()}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {feedbackFormContent.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              {feedbackFormContent.subtitle}
            </p>
          </div>
        </div>

        {/* Submitted Locked Banner */}
        {isSubmitted && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-900 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl shrink-0">
              ✅
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-emerald-950">Feedback Submitted & Recorded</h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Thank you for your valuable feedback on the QIP programme. Your responses are securely recorded and will form part of the aggregated HRDC Programme Report. This form is now locked in read-only mode.
              </p>
            </div>
          </div>
        )}

        {/* Validation Error Banner */}
        {validationError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 shadow-sm flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div className="text-xs text-red-800 font-medium leading-relaxed">
              {validationError}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Instructions</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {feedbackFormContent.instructions}
          </p>
        </div>

        {/* Form Body */}
        {loading ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-christ-navy border-t-christ-gold rounded-full animate-spin" />
            <span className="text-xs text-slate-500 font-medium">Loading feedback form...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <CompositeWidget
              activity={feedbackActivity}
              answers={answers}
              onChange={handleAnswersChange}
              readOnly={isSubmitted}
            />

            {/* Submission Actions */}
            {!isSubmitted && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  ⚠️ Once submitted, your feedback cannot be edited. Please review your answers before submitting.
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => triggerAutoSave(answers)}
                    disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                  >
                    Save Draft
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-christ-navy to-slate-900 text-white text-xs font-bold shadow-md hover:shadow-lg transition transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Feedback'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
