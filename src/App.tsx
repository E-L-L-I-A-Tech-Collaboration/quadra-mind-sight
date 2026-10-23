import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { Sidebar, ActiveView } from './components/Sidebar';
import { AndroidBottomNav } from './components/AndroidBottomNav';
import { AudioBar } from './components/AudioBar';
import { GroundingModal } from './components/GroundingModal';
import { MobileMenuDrawer } from './components/MobileMenuDrawer';
import PaywallModal from './components/PaywallModal';
import StripePaywallModal from './components/StripePaywallModal';
import { useSubscription } from './billing/useSubscription';
import { useWebSubscription } from './billing/useWebSubscription';
import { audioEngine } from './audio/AudioEngine';
import { storageService } from './services/storage';
import { QUADRA_EXERCISES } from './data/exercisesData';
import { CURRICULUM_WAVES } from './data/curriculumData';
import { SightAllocation, JournalEntry, UserProgress, QuadrantKey, UserProfile } from './types';

// Views — code-split with React.lazy so each view loads on demand.
// This keeps the initial bundle lean, which matters most on mobile.
const DashboardView = lazy(() =>
  import('./components/views/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const SessionRunnerView = lazy(() =>
  import('./components/views/SessionRunnerView').then((m) => ({ default: m.SessionRunnerView }))
);
const SightView = lazy(() =>
  import('./components/views/SightView').then((m) => ({ default: m.SightView }))
);
const FacilitatorView = lazy(() =>
  import('./components/views/FacilitatorView').then((m) => ({ default: m.FacilitatorView }))
);
const QuadraSolveView = lazy(() =>
  import('./components/views/QuadraSolveView').then((m) => ({ default: m.QuadraSolveView }))
);
const InterpersonalView = lazy(() =>
  import('./components/views/InterpersonalView').then((m) => ({ default: m.InterpersonalView }))
);
const ExerciseLibraryView = lazy(() =>
  import('./components/views/ExerciseLibraryView').then((m) => ({ default: m.ExerciseLibraryView }))
);
const JournalView = lazy(() =>
  import('./components/views/JournalView').then((m) => ({ default: m.JournalView }))
);
const AudioLabView = lazy(() =>
  import('./components/views/AudioLabView').then((m) => ({ default: m.AudioLabView }))
);
const ModelLabView = lazy(() =>
  import('./components/views/ModelLabView').then((m) => ({ default: m.ModelLabView }))
);
const ProgressView = lazy(() =>
  import('./components/views/ProgressView').then((m) => ({ default: m.ProgressView }))
);
const SettingsView = lazy(() =>
  import('./components/views/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const ProfileView = lazy(() =>
  import('./components/views/ProfileView').then((m) => ({ default: m.ProfileView }))
);

// Shown briefly while a lazily-loaded view's chunk downloads.
const ViewLoadingFallback = (
  <div className="flex-1 flex items-center justify-center bg-[#050508]">
    <div
      className="w-8 h-8 rounded-full border-2 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin"
      role="status"
      aria-label="Loading view"
    />
  </div>
);

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [sight, setSight] = useState<SightAllocation>(storageService.getSightAllocation());
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(storageService.getJournalEntries());
  const [progress, setProgress] = useState<UserProgress>(storageService.getProgress());
  const [profile, setProfile] = useState<UserProfile>(storageService.getProfile());
  const [isGroundModalOpen, setIsGroundModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('quadra_sync');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  // Google Play subscription (Digital Goods API). HARD GATE inside the
  // Android app: the whole app requires an active subscription
  // (a 7-day free trial counts as active — Play reports it as a
  // purchase). On the open web the Digital Goods API does not exist,
  // status stays 'unavailable', and the app runs ungated.
  const sub = useSubscription();

  // Stripe subscription (open web). Gates Waves 5-8 behind M.I.N.D. Sight
  // Premium ($14.99/month). Independent of the Google Play flow above, which
  // only exists inside the Android TWA.
  const webSub = useWebSubscription(
    profile.uid,
    profile.accountTier === 'free' || profile.accountTier === 'premium'
      ? profile.accountTier
      : 'practitioner',
  );
  const [stripePaywallOpen, setStripePaywallOpen] = useState(false);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const webSubRefreshRef = React.useRef(webSub.refresh);
  webSubRefreshRef.current = webSub.refresh;

  // Stripe redirect-back: ?billing=success | ?billing=cancelled
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get('billing');
    if (billing !== 'success' && billing !== 'cancelled') return;
    window.history.replaceState({}, '', window.location.pathname);
    if (billing === 'cancelled') {
      setBillingNotice('Checkout was cancelled — no charge was made.');
      return;
    }
    setBillingNotice('Welcome to M.I.N.D. Sight Premium — your subscription is activating.');
    // The webhook usually lands within seconds; poll so the tier flips
    // without requiring a manual refresh.
    const refresh = webSubRefreshRef.current;
    void refresh();
    const t1 = window.setTimeout(() => void refresh(), 4000);
    const t2 = window.setTimeout(() => void refresh(), 12000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror a server-side premium grant into the local profile so the whole
  // UI (wave picker, profile view) reflects the entitlement.
  useEffect(() => {
    if (webSub.status === 'ready' && webSub.premium && profile.accountTier !== 'premium') {
      const updated = storageService.saveProfile({ ...profile, accountTier: 'premium' });
      setProfile(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webSub.status, webSub.premium]);

  // Enforce the tier matrix: Waves 5-8 are Premium-only. If a non-premium
  // account somehow has a higher wave selected, clamp back to Wave 4.
  useEffect(() => {
    if (webSub.status === 'ready' && !webSub.premium && progress.currentWave > 4) {
      const updated = storageService.updateCurrentWave(4);
      setProgress(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webSub.status, webSub.premium]);

  // Subscribe to Audio Engine state
  useEffect(() => {
    const unsub = audioEngine.subscribe((cfg) => {
      setAudioIsPlaying(cfg.isPlaying);
    });
    return unsub;
  }, []);

  // System clock timer
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentWave =
    CURRICULUM_WAVES.find((w) => w.wave === progress.currentWave) || CURRICULUM_WAVES[0];

  const handleSelectWave = (waveNumber: number) => {
    // Waves 5-8 are Premium-only on the web: show the Stripe paywall
    // instead of switching. Free and practitioner tiers keep Waves 1-4.
    if (waveNumber > 4 && !webSub.premium) {
      setStripePaywallOpen(true);
      return;
    }
    const updated = storageService.updateCurrentWave(waveNumber);
    setProgress(updated);
  };

  const handleSightChange = (newSight: SightAllocation) => {
    setSight(newSight);
    storageService.saveSightAllocation(newSight);
  };

  const handleStartExercise = (exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
    setIsSessionActive(true);
    setActiveView('session_runner');
  };

  const handleFinishSession = (entryData: Partial<JournalEntry>) => {
    const newEntry: JournalEntry = {
      id: `entry_${Date.now()}`,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      exerciseId: entryData.exerciseId || selectedExerciseId,
      exerciseTitle: entryData.exerciseTitle || 'Guided Reflection',
      durationSeconds: entryData.durationSeconds || 600,
      stateBefore: entryData.stateBefore || 'Baseline focus',
      stateAfter: entryData.stateAfter || 'Grounded stillness',
      memory: entryData.memory || '',
      meaning: entryData.meaning || '',
      presentSensation: entryData.presentSensation || '',
      possibleFuture: entryData.possibleFuture || '',
      unexpectedObservation: entryData.unexpectedObservation || '',
      integration: entryData.integration || 'Consciousness observed across four perspectives.',
      rating: entryData.rating || 5,
      quadrantFocus: entryData.quadrantFocus || 'meta',
      sightSnapshot: sight,
    };

    const updated = storageService.saveJournalEntry(newEntry);
    setJournalEntries(updated);
    setProgress(storageService.getProgress());
    setIsSessionActive(false);
    setActiveView('journal');
  };

  const handleLogQuickInsight = (text: string, quadrant: QuadrantKey) => {
    const newEntry: JournalEntry = {
      id: `entry_quick_${Date.now()}`,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      exerciseId: 'quick_insight',
      exerciseTitle: `Quick Insight (${quadrant.toUpperCase()})`,
      durationSeconds: 120,
      stateBefore: 'Active observation',
      stateAfter: 'Reflected',
      memory: quadrant === 'memory' ? text : '',
      meaning: quadrant === 'meaning' ? text : '',
      presentSensation: quadrant === 'present' ? text : '',
      possibleFuture: quadrant === 'future' ? text : '',
      unexpectedObservation: '',
      integration: text,
      rating: 5,
      quadrantFocus: quadrant,
      sightSnapshot: sight,
    };

    const updated = storageService.saveJournalEntry(newEntry);
    setJournalEntries(updated);
    setProgress(storageService.getProgress());
  };

  const handleDataReset = () => {
    setSight(storageService.getSightAllocation());
    setJournalEntries(storageService.getJournalEntries());
    setProgress(storageService.getProgress());
    setProfile(storageService.getProfile());
    setActiveView('dashboard');
  };

  const activeExercise =
    QUADRA_EXERCISES.find((ex) => ex.id === selectedExerciseId) || QUADRA_EXERCISES[0];

  // Hard gate (Android app only): render no app UI until the
  // subscription check resolves, and none at all while there is no
  // active subscription. 'premium' and 'unavailable' (open web) fall
  // through to the full app below.
  if (sub.status === 'loading') {
    return (
      <div className="h-[100dvh] w-full bg-[#050508] flex flex-col items-center justify-center gap-4">
        <div
          className="w-8 h-8 rounded-full border-2 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin"
          role="status"
          aria-label="Checking subscription"
        />
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-white/50">
          Checking subscription…
        </p>
      </div>
    );
  }
  if (sub.status === 'free') {
    return (
      <div className="h-[100dvh] w-full bg-[#050508]">
        <PaywallModal
          isOpen
          blocking
          onClose={() => {}}
          sub={sub}
        />
      </div>
    );
  }

  return (
    <div
      id="quadra-minds-app-root"
      className="h-[100dvh] min-h-[100dvh] w-full max-w-full bg-[#050508] text-[#E0E0E0] font-sans flex flex-col overflow-hidden select-none"
    >
      {/* Top Header */}
      <Header
        currentWave={currentWave}
        onSelectWave={handleSelectWave}
        sessionTimeDisplay={currentTimeStr}
        isSessionActive={isSessionActive}
        onOpenGroundModal={() => setIsGroundModalOpen(true)}
        audioIsPlaying={audioIsPlaying}
        onNavigateHome={() => setActiveView('dashboard')}
        onNavigateProfile={() => setActiveView('profile')}
        profile={profile}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* Main Center Body (Sidebar + Content View) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Navigation Sidebar */}
        <Sidebar
          activeView={activeView}
          onSelectView={(view) => {
            if (view === 'quadra_sync') {
              handleStartExercise('quadra_sync');
            } else {
              setActiveView(view);
            }
          }}
          onOpenGroundModal={() => setIsGroundModalOpen(true)}
          isSessionActive={isSessionActive}
        />

        {/* Dynamic View Host */}
        <main id="view-host-container" className="flex-1 flex flex-col overflow-hidden bg-[#050508]">
          <Suspense fallback={ViewLoadingFallback}>
          {activeView === 'dashboard' && (
            <DashboardView
              sight={sight}
              onSightChange={handleSightChange}
              onStartExercise={handleStartExercise}
              onNavigate={setActiveView}
              recentJournals={journalEntries}
              currentWave={currentWave}
              onSelectWave={handleSelectWave}
              allExercises={QUADRA_EXERCISES}
              onLogQuickInsight={handleLogQuickInsight}
            />
          )}

          {activeView === 'session_runner' && (
            <SessionRunnerView
              exercise={activeExercise}
              sight={sight}
              onSightChange={handleSightChange}
              onFinishSession={handleFinishSession}
              onExitSession={() => {
                setIsSessionActive(false);
                setActiveView('dashboard');
              }}
              onOpenGroundModal={() => setIsGroundModalOpen(true)}
            />
          )}

          {activeView === 'sight' && (
            <SightView
              sight={sight}
              onSightChange={handleSightChange}
              onOpenGroundModal={() => setIsGroundModalOpen(true)}
            />
          )}

          {activeView === 'facilitator' && (
            <FacilitatorView onOpenGroundModal={() => setIsGroundModalOpen(true)} />
          )}

          {activeView === 'quadra_solve' && (
            <QuadraSolveView />
          )}

          {activeView === 'interpersonal' && (
            <InterpersonalView />
          )}

          {activeView === 'exercises' && (
            <ExerciseLibraryView
              exercises={QUADRA_EXERCISES}
              onStartExercise={handleStartExercise}
              currentWave={currentWave}
              onSelectActiveWave={handleSelectWave}
            />
          )}

          {activeView === 'journal' && (
            <JournalView
              entries={journalEntries}
              onEntriesChange={setJournalEntries}
              profile={profile}
              onNavigateToProfile={() => setActiveView('profile')}
            />
          )}

          {activeView === 'audio_lab' && (
            <AudioLabView onOpenGroundModal={() => setIsGroundModalOpen(true)} />
          )}

          {activeView === 'model_lab' && (
            <ModelLabView />
          )}

          {activeView === 'progress' && (
            <ProgressView
              progress={progress}
              journalEntries={journalEntries}
              onStartExercise={handleStartExercise}
              onSelectWave={handleSelectWave}
            />
          )}

          {activeView === 'profile' && (
            <ProfileView
              profile={profile}
              onProfileUpdate={setProfile}
              onOpenGroundModal={() => setIsGroundModalOpen(true)}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              onDataReset={handleDataReset}
              onOpenGroundModal={() => setIsGroundModalOpen(true)}
            />
          )}
          </Suspense>
        </main>
      </div>

      {/* Persistent Audio Engine Bar */}
      <AudioBar onOpenAudioLab={() => setActiveView('audio_lab')} />

      {/* Android Ergonomic Bottom Navigation Bar */}
      <AndroidBottomNav
        activeView={activeView}
        onSelectView={(view) => {
          if (view === 'quadra_sync') {
            handleStartExercise('quadra_sync');
          } else {
            setActiveView(view);
          }
        }}
        isSessionActive={isSessionActive}
        onOpenMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* Mobile Full Navigation Menu Drawer */}
      <MobileMenuDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activeView={activeView}
        onSelectView={(view) => {
          if (view === 'quadra_sync') {
            handleStartExercise('quadra_sync');
          } else {
            setActiveView(view);
          }
        }}
        currentWave={currentWave}
        isSessionActive={isSessionActive}
        onOpenGroundModal={() => setIsGroundModalOpen(true)}
        profile={profile}
      />

      {/* Stripe paywall (open web): Waves 5-8 / Premium upsell */}
      <StripePaywallModal
        isOpen={stripePaywallOpen}
        onClose={() => setStripePaywallOpen(false)}
        initialEmail={profile.email || ''}
        subscribing={webSub.subscribing}
        error={webSub.error}
        billingConfigured={webSub.billingConfigured}
        onSubscribe={(email) => void webSub.subscribe(email)}
      />

      {/* Post-checkout notice banner */}
      {billingNotice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)]">
          <div className="flex items-center gap-3 bg-[#0A0D18] border border-[#D4AF37]/50 px-4 py-3 shadow-[0_0_30px_rgba(212,175,55,0.15)]">
            <p className="flex-1 text-xs text-white/85">{billingNotice}</p>
            <button
              type="button"
              onClick={() => setBillingNotice(null)}
              className="text-white/60 hover:text-white text-xs font-mono uppercase tracking-[0.2em] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Safety Re-Orientation Grounding Modal */}
      <GroundingModal
        isOpen={isGroundModalOpen}
        onClose={() => setIsGroundModalOpen(false)}
        onReturnToDashboard={() => {
          setIsSessionActive(false);
          setActiveView('dashboard');
        }}
      />
    </div>
  );
}
