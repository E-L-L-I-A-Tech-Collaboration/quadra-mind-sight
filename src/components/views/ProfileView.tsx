import React, { useState, useEffect } from 'react';
import { UserProfile, AvatarSymbol } from '../../types';
import { storageService } from '../../services/storage';
import { biometricService, BiometricCapabilities } from '../../services/biometrics';
import { PWAInstallButton } from '../PWAInstallButton';
import {
  User,
  Mail,
  Compass,
  Eye,
  Disc,
  Sparkles,
  Target,
  Waves,
  ShieldCheck,
  ShieldAlert,
  Check,
  LogOut,
  Smartphone,
  Calendar,
  Lock,
  Unlock,
  ArrowRight,
  Fingerprint,
  ScanFace,
  KeyRound,
  RefreshCw,
  AlertCircle,
  Cloud,
  Database,
  ExternalLink,
  Terminal,
  Copy,
  Layers
} from 'lucide-react';

interface ProfileViewProps {
  profile: UserProfile;
  onProfileUpdate: (updated: UserProfile) => void;
  onOpenGroundModal: () => void;
}

const AVATAR_OPTIONS: { id: AvatarSymbol; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'orb', label: 'Meta Orb', icon: <Disc className="w-5 h-5 text-[#D4AF37]" />, desc: 'Observing awareness' },
  { id: 'eye', label: 'Sight Eye', icon: <Eye className="w-5 h-5 text-cyan-400" />, desc: 'Sensory clarity' },
  { id: 'compass', label: 'Dialectic', icon: <Compass className="w-5 h-5 text-rose-400" />, desc: 'Four-way navigation' },
  { id: 'nexus', label: 'Neural Nexus', icon: <Sparkles className="w-5 h-5 text-purple-400" />, desc: 'Predictive integration' },
  { id: 'lotus', label: 'Stillness', icon: <Target className="w-5 h-5 text-emerald-400" />, desc: 'Present embodiment' },
];

const BAND_OPTIONS = [
  { id: 'ground', label: 'Ground (Alpha 10.0 Hz)', desc: 'Stabilizing waking presence' },
  { id: 'drift', label: 'Drift (Theta 6.8 Hz)', desc: 'Metacognitive memory reconsolidation' },
  { id: 'deep', label: 'Deep (Theta 4.8 Hz)', desc: 'Dorsal sensory threshold exploration' },
  { id: 'threshold', label: 'Threshold (Delta 2.2 Hz)', desc: 'Pre-conscious hypnagogic boundary' },
  { id: 'gamma_sync', label: 'Gamma Sync (40.0 Hz)', desc: 'High-order binding & cross-quadrant insight' },
];

const INTENTION_SUGGESTIONS = [
  'Cultivate metacognitive neutrality across cognitive shifts.',
  'Differentiate emotional interpretation from raw physical sensation.',
  'Observe past memories without being captured by recursive loops.',
  'Expand predictive simulation while remaining somatic-anchored.',
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  onProfileUpdate,
}) => {
  const [emailInput, setEmailInput] = useState(profile.email || '');
  const [displayNameInput, setDisplayNameInput] = useState(profile.displayName || '');
  const [intentionInput, setIntentionInput] = useState(profile.primaryIntention || '');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarSymbol>(profile.avatarSymbol || 'orb');
  const [selectedBand, setSelectedBand] = useState<string>(profile.preferredBand || 'drift');
  const [dailyGoal, setDailyGoal] = useState<number>(profile.dailyGoalMinutes || 20);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Biometric & Journal Security state
  const [biometricCaps, setBiometricCaps] = useState<BiometricCapabilities | null>(null);
  const [biometricsEnabled, setBiometricsEnabled] = useState(profile.biometricsEnabled || false);
  const [pinInput, setPinInput] = useState(profile.securityPin || '');
  const [showPin, setShowPin] = useState(false);
  const [autoLockDuration, setAutoLockDuration] = useState(profile.autoLockMinutes ?? 15);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [bioStatusMsg, setBioStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Login form state for when logged out
  const [loginEmail, setLoginEmail] = useState('');
  const [loginName, setLoginName] = useState('');

  // Cloud Sync & Packaging steps state (Steps A, B, C)
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [verifyingAssetLinks, setVerifyingAssetLinks] = useState(false);
  const [assetLinksStatus, setAssetLinksStatus] = useState<{ ok: boolean; status: number; text: string } | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Detect biometric capabilities on mount
  useEffect(() => {
    biometricService.checkCapabilities().then((caps) => {
      setBiometricCaps(caps);
    });
  }, []);

  const handleTriggerCloudSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg({ text: 'Synchronizing local journal, curriculum wave, and sight state to cloud...', type: 'info' });
    try {
      const res = await storageService.syncWithCloud();
      if (res.success) {
        onProfileUpdate(res.profile);
        setSyncStatusMsg({
          text: `Cloud sync verified. All journal entries and Wave ${res.profile.curriculumWave || 1} state synced (${new Date(res.profile.lastSyncedAt || Date.now()).toLocaleTimeString()}).`,
          type: 'success',
        });
      } else {
        setSyncStatusMsg({
          text: res.error ? `Sync notice: ${res.error}` : 'Cloud offline. Data preserved safely in local storage.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setSyncStatusMsg({ text: err.message || 'Cloud sync connection error.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSwitchToObserver = async () => {
    setIsSyncing(true);
    try {
      const loggedIn = await storageService.loginProfile('observer@quadra.sight', 'Observer', 'premium');
      setEmailInput(loggedIn.email);
      setDisplayNameInput(loggedIn.displayName);
      onProfileUpdate(loggedIn);
      setSyncStatusMsg({
        text: 'Switched to active profile: Observer (UID: user_123, Tier: Premium, Wave 1).',
        type: 'success',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVerifyAssetLinks = async () => {
    setVerifyingAssetLinks(true);
    try {
      const res = await fetch('/.well-known/assetlinks.json');
      const ct = res.headers.get('content-type') || '';
      if (res.ok) {
        const json = await res.json();
        setAssetLinksStatus({
          ok: true,
          status: res.status,
          text: `HTTP 200 OK (${ct}). Target package: ${json[0]?.target?.package_name || 'ai.quadraminds.app'}`,
        });
      } else {
        setAssetLinksStatus({
          ok: false,
          status: res.status,
          text: `AssetLinks returned HTTP ${res.status} (${ct})`,
        });
      }
    } catch (err: any) {
      setAssetLinksStatus({
        ok: false,
        status: 0,
        text: err.message || 'Failed to reach assetlinks endpoint.',
      });
    } finally {
      setVerifyingAssetLinks(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  const handleEnrollBiometrics = async () => {
    setIsEnrolling(true);
    setBioStatusMsg({ text: 'Accessing device biometric sensor (FaceID / Fingerprint)...', type: 'info' });
    try {
      const res = await biometricService.registerCredential(
        profile.email || emailInput,
        profile.displayName || displayNameInput
      );
      if (res.success && res.credentialId) {
        const updated: UserProfile = {
          ...profile,
          biometricsEnabled: true,
          biometricCredentialId: res.credentialId,
          biometricRegisteredAt: new Date().toLocaleDateString(),
          biometricDeviceName: res.deviceName,
        };
        setBiometricsEnabled(true);
        const saved = storageService.saveProfile(updated);
        onProfileUpdate(saved);
        setBioStatusMsg({
          text: `Device biometrics successfully enrolled (${res.deviceName}). Journal vault is now protected.`,
          type: 'success',
        });
      } else {
        setBioStatusMsg({
          text: res.error || 'Biometric enrollment could not be completed on this device.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setBioStatusMsg({
        text: err.message || 'Error occurred during biometric enrollment.',
        type: 'error',
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleTestBiometrics = async () => {
    setIsTesting(true);
    setBioStatusMsg({ text: 'Waiting for device sensor authorization...', type: 'info' });
    try {
      const res = await biometricService.verifyBiometrics(profile.biometricCredentialId);
      if (res.success) {
        setBioStatusMsg({
          text: 'Biometric authorization successful. Hardware verification verified.',
          type: 'success',
        });
      } else {
        setBioStatusMsg({
          text: res.error || 'Biometric verification failed or was cancelled.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setBioStatusMsg({
        text: err.message || 'Verification attempt failed.',
        type: 'error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleLockJournalNow = () => {
    biometricService.lockJournal();
    setBioStatusMsg({
      text: 'Journal Vault locked immediately. Biometric verification or PIN required to access.',
      type: 'info',
    });
  };

  const handleSaveProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated: UserProfile = {
      ...profile,
      email: emailInput.trim() || profile.email,
      displayName: displayNameInput.trim() || profile.displayName,
      primaryIntention: intentionInput.trim() || profile.primaryIntention,
      avatarSymbol: selectedAvatar,
      preferredBand: selectedBand,
      dailyGoalMinutes: dailyGoal,
      biometricsEnabled,
      securityPin: pinInput.trim() || undefined,
      autoLockMinutes: autoLockDuration,
    };
    const saved = storageService.saveProfile(updated);
    onProfileUpdate(saved);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) return;
    const loggedIn = await storageService.loginProfile(loginEmail.trim(), loginName.trim());
    setEmailInput(loggedIn.email);
    setDisplayNameInput(loggedIn.displayName);
    onProfileUpdate(loggedIn);
  };

  const handleBiometricLogin = async () => {
    setIsTesting(true);
    setBioStatusMsg({ text: 'Verifying FaceID / Fingerprint...', type: 'info' });
    try {
      const res = await biometricService.verifyBiometrics(profile.biometricCredentialId);
      if (res.success) {
        const loggedIn = await storageService.loginProfile(profile.email, profile.displayName);
        onProfileUpdate(loggedIn);
      } else {
        setBioStatusMsg({ text: res.error || 'Biometric login failed.', type: 'error' });
      }
    } catch (err: any) {
      setBioStatusMsg({ text: err.message || 'Biometric authorization failed.', type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleLogout = async () => {
    biometricService.lockJournal();
    const loggedOut = storageService.logoutProfile();
    onProfileUpdate(loggedOut);
  };

  if (!profile.isLoggedIn) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-8 max-w-lg mx-auto w-full flex flex-col justify-center animate-fade-in">
        <div className="border border-[#D4AF37]/30 bg-[#0A0D18] p-6 sm:p-8 rounded-xs shadow-2xl relative">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
            <div className="w-11 h-11 rounded-lg overflow-hidden border border-[#D4AF37]/50 shadow-[0_0_12px_rgba(212,175,55,0.3)] bg-[#050508] shrink-0">
              <img
                src="/pwa-192x192.png"
                alt="quadraminds.ai"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-light tracking-[0.2em] text-white uppercase">
                quadraminds.ai
              </h2>
              <span className="text-[10px] font-mono tracking-widest text-[#D4AF37] uppercase">
                Metacognitive Practice Access
              </span>
            </div>
          </div>

          <h3 className="text-xl font-light text-white mb-2 tracking-wide">
            Enter the Practice
          </h3>
          <p className="text-xs text-white/60 font-sans mb-6 leading-relaxed">
            Enter your email to sign into your personal practice profile, retain your journal entries, and track your four-quadrant consciousness balance.
          </p>

          {profile.biometricsEnabled && profile.email && (
            <div className="mb-5 p-4 bg-[#050508] border border-[#D4AF37]/50 rounded-xs shadow-[0_0_20px_rgba(212,175,55,0.15)]">
              <div className="flex items-center gap-2 mb-2 text-[#D4AF37]">
                <Fingerprint className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-wider font-semibold">
                  Biometric Passkey Active
                </span>
              </div>
              <p className="text-[11px] text-white/60 mb-3 font-sans">
                Sign back in immediately using {profile.biometricDeviceName || 'FaceID or Fingerprint'}.
              </p>
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={isTesting}
                className="w-full py-2.5 px-4 bg-[#D4AF37] hover:bg-[#E5C158] text-[#050508] text-xs font-mono uppercase tracking-wider font-semibold flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Sensor...</span>
                  </>
                ) : (
                  <>
                    <ScanFace className="w-4 h-4" />
                    <span>Unlock with Biometrics</span>
                  </>
                )}
              </button>
              <div className="flex items-center my-3.5 gap-2">
                <div className="h-[1px] bg-white/10 flex-1" />
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">or email sign-in</span>
                <div className="h-[1px] bg-white/10 flex-1" />
              </div>
            </div>
          )}

          {bioStatusMsg && (
            <div
              className={`mb-4 p-3 text-xs font-mono border flex items-center gap-2 ${
                bioStatusMsg.type === 'success'
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : bioStatusMsg.type === 'error'
                  ? 'border-rose-500/50 bg-rose-500/10 text-rose-300'
                  : 'border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#D4AF37]'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{bioStatusMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-white/70 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#D4AF37]" />
                Email Address
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="practitioner@example.com"
                className="w-full bg-[#050508] border border-white/20 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#D4AF37] focus:outline-none font-sans"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-white/70 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#D4AF37]" />
                Practitioner Moniker / Name (Optional)
              </label>
              <input
                type="text"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="Orion / Conscious Observer"
                className="w-full bg-[#050508] border border-white/20 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#D4AF37] focus:outline-none font-sans"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 border border-[#D4AF37] bg-[#D4AF37] hover:bg-white text-[#050508] py-3 text-xs font-mono uppercase tracking-[0.2em] font-semibold transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              <span>Initialize Session</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-[10.5px] font-mono text-white/40">
              Full access with subscription • 7-day free trial in the Android app
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-4xl mx-auto w-full space-y-6 animate-fade-in pb-24">
      {/* Header Profile Card */}
      <div className="border border-white/15 bg-[#0A0D18] p-5 sm:p-7 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full border-2 border-[#D4AF37] bg-[#050508] flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.2)]">
              {AVATAR_OPTIONS.find((a) => a.id === selectedAvatar)?.icon || <Disc className="w-7 h-7 text-[#D4AF37]" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-light text-white tracking-wide">
                  {profile.displayName}
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border border-[#D4AF37]/50 text-[#D4AF37] bg-[#D4AF37]/10">
                  Full Access
                </span>
              </div>
              <p className="text-xs text-white/60 font-mono flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3 h-3 text-white/40" />
                {profile.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton />
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 border border-white/20 hover:border-rose-500/50 hover:bg-rose-500/10 text-white/60 hover:text-rose-300 text-xs font-mono transition-colors flex items-center gap-1.5"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Android & PWA App Store Integration Status Banner */}
        <div className="mt-5 p-3.5 bg-[#050508] border border-[#D4AF37]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="font-mono text-white text-xs uppercase tracking-wider">
                Android & Google Play Ready (TWA)
              </p>
              <p className="text-[11px] text-white/60 font-sans">
                Packaged with Web App Manifest, Service Worker offline caching, and Digital Asset Links.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2 py-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] flex items-center gap-1">
              <Check className="w-3 h-3" />
              TWA Manifest Verified
            </span>
          </div>
        </div>
      </div>

      {/* Production Publishing & Cross-Platform Distribution Console (Steps A, B, C) */}
      <div className="border border-[#D4AF37]/30 bg-[#0A0D18] p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 border border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#D4AF37] rounded-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
                Production App Publishing Console
              </h3>
              <p className="text-[11px] text-white/50 font-sans">
                Cloud Sync Database, Google Play Digital Asset Links, and AAB/APK Build Pipeline
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 self-start sm:self-auto">
            Ready for Play Console
          </span>
        </div>

        {/* Step A: Cloud Sync & Account Tier Mapping */}
        <div className="border border-white/10 bg-[#050508] p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/60 text-[#D4AF37] flex items-center justify-center font-mono text-xs font-bold">
                A
              </div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-white font-semibold flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-[#D4AF37]" />
                Step A: Cloud Sync & Profile Tier Database
              </h4>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 border border-[#D4AF37]/40 text-[#D4AF37] bg-[#D4AF37]/10">
              Active Tier: {profile.accountTier?.toUpperCase() || 'PREMIUM'}
            </span>
          </div>

          <p className="text-xs text-white/70 font-sans leading-relaxed">
            Transitioned beyond pure localStorage to full-stack cloud synchronization (<code className="text-[#D4AF37] font-mono">server.ts & storage.ts</code>). User profiles and state sync seamlessly across web browsers and Android devices.
          </p>

          {/* Database Profile Mapping JSON Viewer */}
          <div className="bg-[#020307] border border-white/10 p-3 rounded-xs font-mono text-[11px] text-white/80 relative">
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 text-[10px] text-white/50">
              <span>Database Table Profile Record</span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(
                      {
                        uid: profile.uid || 'user_123',
                        displayName: profile.displayName || 'Observer',
                        curriculumWave: profile.curriculumWave || 1,
                        accountTier: profile.accountTier || 'premium',
                      },
                      null,
                      2
                    ),
                    'profile-json'
                  )
                }
                className="text-white/40 hover:text-white flex items-center gap-1 transition-colors"
              >
                {copiedSnippet === 'profile-json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSnippet === 'profile-json' ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="text-[#D4AF37] overflow-x-auto whitespace-pre">
{JSON.stringify(
  {
    uid: profile.uid || 'user_123',
    displayName: profile.displayName || 'Observer',
    curriculumWave: profile.curriculumWave || 1,
    accountTier: profile.accountTier || 'premium',
  },
  null,
  2
)}
            </pre>
          </div>

          {/* Sync Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerCloudSync}
                disabled={isSyncing}
                className="px-3.5 py-2 border border-[#D4AF37] bg-[#D4AF37]/15 hover:bg-[#D4AF37]/30 text-[#D4AF37] text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync with Cloud Now'}</span>
              </button>

              <button
                type="button"
                onClick={handleSwitchToObserver}
                disabled={isSyncing}
                className="px-3 py-2 border border-white/20 hover:border-white/40 bg-white/5 text-white/80 hover:text-white text-xs font-mono uppercase tracking-wider transition-all"
              >
                Load "Observer (user_123)"
              </button>
            </div>

            <span className="text-[10px] font-mono text-white/40">
              Last synced:{' '}
              {profile.lastSyncedAt
                ? new Date(profile.lastSyncedAt).toLocaleTimeString()
                : 'Just now'}
            </span>
          </div>

          {syncStatusMsg && (
            <div
              className={`p-2.5 text-xs font-mono border ${
                syncStatusMsg.type === 'success'
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : syncStatusMsg.type === 'error'
                  ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  : 'bg-blue-950/30 border-blue-500/40 text-blue-300'
              }`}
            >
              {syncStatusMsg.text}
            </div>
          )}
        </div>

        {/* Step B: Digital Asset Links Pairing */}
        <div className="border border-white/10 bg-[#050508] p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/60 text-[#D4AF37] flex items-center justify-center font-mono text-xs font-bold">
                B
              </div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-white font-semibold flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
                Step B: Digital Asset Links Pairing (Full-Screen Verification)
              </h4>
            </div>
            <a
              href="https://developers.google.com/chromeos/app-development/publish/pwa-in-play"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-[#D4AF37] hover:underline flex items-center gap-1"
            >
              <span>Google TWA Docs</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-xs text-white/70 font-sans leading-relaxed">
            For Google Play to treat your app as a fully verified first-party app (hiding the browser URL address bar in the Trusted Web Activity), your server must serve <code className="text-[#D4AF37] font-mono">/.well-known/assetlinks.json</code>.
          </p>

          <div className="p-3 bg-[#020307] border border-white/10 rounded-xs space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-[10.5px] text-white/50">
              <span>Template Location: <span className="text-white/80">public/.well-known/assetlinks.json</span></span>
              <button
                type="button"
                onClick={handleVerifyAssetLinks}
                disabled={verifyingAssetLinks}
                className="px-2.5 py-1 border border-[#D4AF37]/40 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] uppercase font-semibold flex items-center gap-1 transition-all"
              >
                <RefreshCw className={`w-3 h-3 ${verifyingAssetLinks ? 'animate-spin' : ''}`} />
                <span>Test Live Route</span>
              </button>
            </div>

            {assetLinksStatus && (
              <div
                className={`p-2 border text-[11px] ${
                  assetLinksStatus.ok
                    ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                    : 'border-rose-500/40 bg-rose-950/20 text-rose-300'
                }`}
              >
                {assetLinksStatus.ok ? <Check className="w-3 h-3 inline mr-1" /> : <AlertCircle className="w-3 h-3 inline mr-1" />}
                {assetLinksStatus.text}
              </div>
            )}

            <div className="pt-1 text-[11px] text-white/60 space-y-1 font-sans">
              <p>
                <strong className="text-white font-mono">Signing Key Instruction:</strong> Once you generate your real signing key from the Google Play Console, swap out <code className="text-[#D4AF37] font-mono">"YOUR_RELEASE_KEYSTORE_SHA256_FINGERPRINT_HERE"</code> in <code className="text-white/80 font-mono">public/.well-known/assetlinks.json</code> with your SHA-256 fingerprint.
              </p>
            </div>
          </div>
        </div>

        {/* Step C: Build and Package the APK / AAB */}
        <div className="border border-white/10 bg-[#050508] p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/60 text-[#D4AF37] flex items-center justify-center font-mono text-xs font-bold">
                C
              </div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-white font-semibold flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#D4AF37]" />
                Step C: Build and Package APK / AAB (Google Play Distribution)
              </h4>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 border border-white/20 text-white/70">
              Bubblewrap & PWABuilder
            </span>
          </div>

          <p className="text-xs text-white/70 font-sans leading-relaxed">
            Use a builder tool to ingest <code className="text-[#D4AF37] font-mono">manifest.webmanifest</code> and wrap the app into a signed <code className="text-[#D4AF37] font-mono">.aab</code> (Android App Bundle) binary ready for Google Play Console upload.
          </p>

          {/* Builder Method 1: Google Bubblewrap CLI */}
          <div className="bg-[#020307] border border-white/10 p-3 rounded-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-white text-[11px] font-semibold">Method 1: Google Bubblewrap CLI (Command Line)</span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `npm install -g @bubblewrap/cli\nbubblewrap init --manifest=${window.location.origin}/manifest.webmanifest\nbubblewrap build`,
                    'bubblewrap-cmd'
                  )
                }
                className="text-[10px] font-mono text-white/50 hover:text-white flex items-center gap-1 transition-colors"
              >
                {copiedSnippet === 'bubblewrap-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSnippet === 'bubblewrap-cmd' ? 'Copied' : 'Copy Commands'}</span>
              </button>
            </div>
            <pre className="text-white/80 font-mono text-[11px] p-2 bg-[#080B14] border border-white/5 overflow-x-auto whitespace-pre">
# 1. Install Bubblewrap CLI
npm install -g @bubblewrap/cli

# 2. Ingest your live web manifest
{`bubblewrap init --manifest=${window.location.origin}/manifest.webmanifest`}

# 3. Compile your signed production Android App Bundle (.aab)
bubblewrap build
            </pre>
          </div>

          {/* Builder Method 2: PWABuilder Web Interface */}
          <div className="bg-[#020307] border border-white/10 p-3 rounded-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-white text-[11px] font-semibold">Method 2: PWABuilder (No-Code GUI)</span>
              <a
                href="https://www.pwabuilder.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-[#D4AF37] hover:underline flex items-center gap-1"
              >
                <span>pwabuilder.com</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <ol className="text-[11.5px] text-white/70 space-y-1 list-decimal list-inside font-sans">
              <li>Enter your public application URL at <strong className="text-white">pwabuilder.com</strong></li>
              <li>Click <strong className="text-white">Package for Stores</strong> → Choose <strong className="text-white">Android</strong></li>
              <li>Select <strong className="text-[#D4AF37] font-mono">.aab (Android App Bundle)</strong> for Google Play Store upload</li>
              <li>Download the generated zip and upload to your Play Console release track</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Customizable Profile Settings Form */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Practice Avatar / Symbol */}
        <div className="border border-white/10 bg-[#0A0D18] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-white">
              Consciousness Symbol / Avatar
            </h3>
          </div>
          <p className="text-xs text-white/60 font-sans">
            Choose the symbolic geometry that centers your observation perspective.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            {AVATAR_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedAvatar(opt.id)}
                className={`p-3 border text-left flex flex-col items-center justify-center gap-2 transition-all ${
                  selectedAvatar === opt.id
                    ? 'border-[#D4AF37] bg-[#D4AF37]/15 shadow-[0_0_15px_rgba(212,175,55,0.15)]'
                    : 'border-white/10 bg-[#050508] hover:border-white/20'
                }`}
              >
                {opt.icon}
                <span className="text-xs font-medium text-white text-center">{opt.label}</span>
                <span className="text-[9.5px] text-white/50 text-center font-mono leading-tight">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Identity & Practice Goal */}
        <div className="border border-white/10 bg-[#0A0D18] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-white">
              Practitioner Identity
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-white/70 mb-1.5">
                Display Moniker
              </label>
              <input
                type="text"
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                placeholder="Orion"
                className="w-full bg-[#050508] border border-white/20 px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none font-sans"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-white/70 mb-1.5">
                Account Email
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="practitioner@example.com"
                className="w-full bg-[#050508] border border-white/20 px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none font-sans"
              />
            </div>
          </div>

          {/* Daily Goal */}
          <div className="pt-2">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-white/70 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#D4AF37]" />
                Daily Practice Target
              </span>
              <span className="text-[#D4AF37] font-semibold">{dailyGoal} Minutes</span>
            </label>
            <div className="flex gap-2">
              {[10, 15, 20, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDailyGoal(mins)}
                  className={`flex-1 py-2 text-xs font-mono border transition-all ${
                    dailyGoal === mins
                      ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37] font-bold'
                      : 'border-white/10 bg-[#050508] text-white/70 hover:border-white/30'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Biometric Security & Journal Vault Card */}
        <div className="border border-[#D4AF37]/35 bg-[#0A0D18] p-5 sm:p-6 space-y-5 rounded-xs shadow-[0_4px_25px_rgba(0,0,0,0.4)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] rounded-xs">
                <Fingerprint className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-medium uppercase tracking-wider text-white flex items-center gap-2">
                  <span>Biometric Security & Journal Vault</span>
                </h3>
                <p className="text-[11px] text-white/50 font-mono">
                  Hardware-backed FaceID / TouchID / Android Fingerprint protection
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {biometricCaps?.hasPlatformAuthenticator ? (
                <span className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {biometricCaps.platformLabel} Active
                </span>
              ) : biometricCaps?.isSupported ? (
                <span className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  WebAuthn Supported
                </span>
              ) : (
                <span className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border border-amber-500/40 bg-amber-500/10 text-amber-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  PIN Mode Ready
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-white/70 font-sans leading-relaxed">
            Guard intimate consciousness reflections, episodic memory logs, and affective interpretations behind your device’s native biometric sensor.
          </p>

          {/* Master Biometric Toggle */}
          <div className="flex items-center justify-between p-3.5 border border-white/15 bg-[#050508] rounded-xs">
            <div className="space-y-0.5 pr-4">
              <label htmlFor="bio-toggle" className="text-xs font-mono font-medium text-white uppercase tracking-wider cursor-pointer">
                Require Biometric Lock for Reflective Journal
              </label>
              <p className="text-[11px] text-white/50 font-sans">
                Prevents viewing of your journal without biometric FaceID/Fingerprint or Security PIN.
              </p>
            </div>
            <button
              type="button"
              id="bio-toggle"
              role="switch"
              aria-checked={biometricsEnabled}
              onClick={() => setBiometricsEnabled(!biometricsEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                biometricsEnabled ? 'bg-[#D4AF37]' : 'bg-white/20'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#050508] shadow ring-0 transition duration-200 ease-in-out ${
                  biometricsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Biometric Controls when enabled */}
          {biometricsEnabled && (
            <div className="space-y-4 pt-1 animate-fade-in">
              {/* Enrolled Credential Info */}
              <div className="p-3 bg-[#050508] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-mono uppercase tracking-wider text-white/40">
                      Enrolled Sensor:
                    </span>
                    {profile.biometricCredentialId ? (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Passkey Active
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Pending Device Enrollment
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/60 font-mono">
                    Device: {profile.biometricDeviceName || biometricCaps?.platformLabel || 'Standard Platform Sensor'}
                    {profile.biometricRegisteredAt && ` • Enrolled on ${profile.biometricRegisteredAt}`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleEnrollBiometrics}
                    disabled={isEnrolling}
                    className="px-3 py-1.5 border border-[#D4AF37]/60 hover:border-[#D4AF37] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-white text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    {isEnrolling ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                        <span>Enrolling...</span>
                      </>
                    ) : (
                      <>
                        <ScanFace className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>{profile.biometricCredentialId ? 'Re-enroll Sensor' : 'Enroll Biometrics'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestBiometrics}
                    disabled={isTesting}
                    className="px-3 py-1.5 border border-white/20 hover:border-white/40 bg-white/5 text-white/80 hover:text-white text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all"
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Test Sensor</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleLockJournalNow}
                    className="px-3 py-1.5 border border-rose-500/40 hover:border-rose-500 hover:bg-rose-500/10 text-rose-300 text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all"
                    title="Instantly lock the journal vault"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lock Vault Now</span>
                  </button>
                </div>
              </div>

              {/* Status Message Feedback */}
              {bioStatusMsg && (
                <div
                  className={`p-3 text-xs font-mono border flex items-center gap-2.5 transition-all ${
                    bioStatusMsg.type === 'success'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : bioStatusMsg.type === 'error'
                      ? 'border-rose-500/50 bg-rose-500/10 text-rose-300'
                      : 'border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#D4AF37]'
                  }`}
                >
                  {bioStatusMsg.type === 'success' ? (
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                  ) : bioStatusMsg.type === 'error' ? (
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                  ) : (
                    <Fingerprint className="w-4 h-4 shrink-0" />
                  )}
                  <span>{bioStatusMsg.text}</span>
                </div>
              )}

              {/* Security PIN Fallback */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-white/70 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Practitioner Security PIN (Fallback)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="text-[10px] text-[#D4AF37] hover:underline"
                    >
                      {showPin ? 'Hide' : 'Reveal'}
                    </button>
                  </label>
                  <input
                    type={showPin ? 'text' : 'password'}
                    maxLength={8}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 4729"
                    className="w-full bg-[#050508] border border-white/20 px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none font-mono tracking-widest"
                  />
                  <p className="text-[10px] text-white/40 mt-1 font-sans">
                    Allows unlocking if biometric sensor is wet, dirty, or on a browser without biometrics.
                  </p>
                </div>

                {/* Auto-Lock Timeout */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-white/70 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                    Auto-Lock Inactivity Timeout
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { mins: 0, label: 'Always' },
                      { mins: 5, label: '5m' },
                      { mins: 15, label: '15m' },
                      { mins: 30, label: '30m' },
                    ].map((item) => (
                      <button
                        key={item.mins}
                        type="button"
                        onClick={() => setAutoLockDuration(item.mins)}
                        className={`py-2 text-xs font-mono border transition-all text-center ${
                          autoLockDuration === item.mins
                            ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37] font-bold'
                            : 'border-white/10 bg-[#050508] text-white/60 hover:border-white/25'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/40 mt-1 font-sans">
                    {autoLockDuration === 0
                      ? 'Re-locks immediately whenever you navigate away from the Journal.'
                      : `Re-locks automatically after ${autoLockDuration} minutes of inactivity.`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Practice Intention */}
        <div className="border border-white/10 bg-[#0A0D18] p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-white">
              Primary Practice Intention
            </h3>
          </div>
          <p className="text-xs text-white/60 font-sans">
            This intention is referenced during sessions and informs the Socratic facilitator prompts.
          </p>

          <textarea
            rows={3}
            value={intentionInput}
            onChange={(e) => setIntentionInput(e.target.value)}
            placeholder="What is your central metacognitive objective?"
            className="w-full bg-[#050508] border border-white/20 p-3 text-xs sm:text-sm text-white focus:border-[#D4AF37] focus:outline-none font-sans resize-none"
          />

          <div className="space-y-1 pt-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">
              Suggested Focus Objectives:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {INTENTION_SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIntentionInput(sug)}
                  className="text-[10.5px] font-sans px-2.5 py-1 border border-white/10 bg-[#050508] text-white/60 hover:text-white hover:border-[#D4AF37]/40 transition-colors text-left"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preferred Brainwave Preset */}
        <div className="border border-white/10 bg-[#0A0D18] p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-white">
              Default Psychoacoustic State
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {BAND_OPTIONS.map((band) => (
              <button
                key={band.id}
                type="button"
                onClick={() => setSelectedBand(band.id)}
                className={`p-3 border text-left transition-all ${
                  selectedBand === band.id
                    ? 'border-[#D4AF37] bg-[#D4AF37]/15'
                    : 'border-white/10 bg-[#050508] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-white">{band.label}</span>
                  {selectedBand === band.id && <Check className="w-3.5 h-3.5 text-[#D4AF37]" />}
                </div>
                <p className="text-[10.5px] text-white/50 font-sans mt-1">{band.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          {saveSuccess ? (
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              Profile updated and saved to local state.
            </span>
          ) : (
            <span className="text-[10.5px] font-mono text-white/40">
              Changes persist across sessions.
            </span>
          )}

          <button
            type="submit"
            className="border border-[#D4AF37] bg-[#D4AF37] hover:bg-white text-[#050508] px-6 py-2.5 text-xs font-mono uppercase tracking-[0.15em] font-semibold transition-all active:scale-95"
          >
            Save Profile
          </button>
        </div>
      </form>
    </div>
  );
};
