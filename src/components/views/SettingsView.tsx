import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storage';
import { audioEngine } from '../../audio/AudioEngine';
import { Settings as SettingsIcon, Headphones, ShieldAlert, Download, Upload, Trash2, CheckCircle2, ArrowLeftRight, Check } from 'lucide-react';

interface SettingsViewProps {
  onDataReset: () => void;
  onOpenGroundModal: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onDataReset, onOpenGroundModal }) => {
  const [testingEar, setTestingEar] = useState<'left' | 'right' | null>(null);
  const [swapChannels, setSwapChannels] = useState<boolean>(audioEngine.config.swapChannels);
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    const unsub = audioEngine.subscribe((cfg) => {
      setSwapChannels(cfg.swapChannels);
    });
    return unsub;
  }, []);

  const handleTestHeadphones = async (ear: 'left' | 'right') => {
    setTestingEar(ear);
    await audioEngine.testHeadphones(ear);
    setTimeout(() => setTestingEar(null), 1800);
  };

  const handleToggleSwap = (swap: boolean) => {
    audioEngine.setSwapChannels(swap);
  };

  const handleResetAllData = () => {
    storageService.resetData();
    onDataReset();
    setResetConfirm(false);
    alert('Application data reset to baseline.');
  };

  const handleExport = () => {
    const data = storageService.exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quadra_minds_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="settings-view" className="flex-1 p-4 sm:p-8 overflow-y-auto max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-white/10 pb-4">
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#D4AF37] block mb-1">
          Configuration & Calibration
        </span>
        <h2 className="text-xl sm:text-2xl font-light text-white tracking-wide flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-[#D4AF37]" />
          SYSTEM SETTINGS & ETHICS
        </h2>
        <p className="text-xs text-white/60 mt-1 max-w-xl font-light">
          Audio calibration checks, data export/import, safety protocols, and ethical governance standards.
        </p>
      </div>

      {/* Headphone Verification & Channel Calibration */}
      <div className="border border-white/10 bg-[#050508]/90 p-6 rounded-xs space-y-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Headphones className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-xs font-mono uppercase tracking-widest text-white font-bold">
              Stereo Headphone Channel Calibration
            </h3>
          </div>
          <span className="text-[9px] font-mono text-[#D4AF37] uppercase bg-[#D4AF37]/10 px-2 py-0.5 rounded-xs border border-[#D4AF37]/30">
            Dichotic Signal Alignment
          </span>
        </div>

        <p className="text-xs text-white/70 font-light font-sans leading-relaxed">
          Binaural beats and spatial soundscapes depend on pristine stereo separation.
          If your headphones are oriented backwards or your sound card mirrors Left and Right,
          auditory spatial navigation will feel disorienting.
        </p>

        {/* Current Orientation Selector */}
        <div className="bg-black/50 border border-white/10 p-4 rounded-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/70 flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5 text-[#8B5CF6]" />
              Hardware Stereo Channel Routing
            </span>
            <span className="text-[10px] font-mono text-white/50">
              Active: <strong className={swapChannels ? 'text-amber-400' : 'text-emerald-400'}>
                {swapChannels ? 'Inverted (R ⇄ L)' : 'Standard (L ⇄ R)'}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => handleToggleSwap(false)}
              className={`p-3 border rounded-xs text-left transition-all ${
                !swapChannels
                  ? 'border-emerald-500 bg-emerald-950/20 text-white shadow-xs'
                  : 'border-white/10 hover:border-white/20 text-white/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
                  {!swapChannels && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  Standard Routing
                </span>
                <span className="text-[9px] font-mono text-white/40">Default</span>
              </div>
              <p className="text-[11px] text-white/60 font-light">
                Left oscillator → Left ear. Right oscillator → Right ear.
              </p>
            </button>

            <button
              onClick={() => handleToggleSwap(true)}
              className={`p-3 border rounded-xs text-left transition-all ${
                swapChannels
                  ? 'border-amber-500 bg-amber-950/20 text-white shadow-xs'
                  : 'border-white/10 hover:border-white/20 text-white/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
                  {swapChannels && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  Inverted / Swapped
                </span>
                <span className="text-[9px] font-mono text-amber-400/80">Swapped</span>
              </div>
              <p className="text-[11px] text-white/60 font-light">
                Reverses channels at the master bus if your audio outputs backwards.
              </p>
            </button>
          </div>
        </div>

        {/* Acoustic Channel Test Buttons */}
        <div>
          <span className="text-[10px] font-mono uppercase text-white/50 block mb-2 font-bold">
            Auditory Ear Tests
          </span>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleTestHeadphones('left')}
              disabled={testingEar !== null}
              className={`px-5 py-2.5 border text-xs font-mono uppercase tracking-wider rounded-xs transition-all flex items-center gap-2 ${
                testingEar === 'left'
                  ? 'border-emerald-400 bg-emerald-950/40 text-emerald-400 font-bold animate-pulse'
                  : 'border-white/10 hover:border-white/30 text-white/80'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Play Tone in Left Ear (440 Hz)
            </button>

            <button
              onClick={() => handleTestHeadphones('right')}
              disabled={testingEar !== null}
              className={`px-5 py-2.5 border text-xs font-mono uppercase tracking-wider rounded-xs transition-all flex items-center gap-2 ${
                testingEar === 'right'
                  ? 'border-emerald-400 bg-emerald-950/40 text-emerald-400 font-bold animate-pulse'
                  : 'border-white/10 hover:border-white/30 text-white/80'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
              Play Tone in Right Ear (554 Hz)
            </button>
          </div>
        </div>

        {testingEar && (
          <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xs text-xs font-mono text-emerald-300">
            Testing <strong>{testingEar.toUpperCase()}</strong> channel. If you heard the sound in your opposite ear, toggle to <strong>Inverted / Swapped</strong> above.
          </div>
        )}
      </div>

      {/* Data Management */}
      <div className="border border-white/10 bg-[#050508]/90 p-6 rounded-xs space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-widest text-white font-bold border-b border-white/5 pb-3">
          Local Data Sovereignty & Portability
        </h3>

        <p className="text-xs text-white/70 font-light font-sans leading-relaxed">
          All session journals, attention sight allocations, and progress metrics are stored strictly inside your browser's private local storage.
          You can download a full backup at any time.
        </p>

        <p className="text-xs font-light font-sans leading-relaxed">
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#9db4ff] underline underline-offset-2 hover:text-white transition-colors"
          >
            Privacy Policy
          </a>
          <span className="text-white/50"> — how the app handles your data, in full.</span>
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 border border-white/15 hover:border-white/40 text-white text-xs font-mono uppercase tracking-wider rounded-xs flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-[#D4AF37]" />
            Export Complete Backup (.JSON)
          </button>

          {resetConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetAllData}
                className="px-4 py-2 bg-red-600 text-white text-xs font-mono uppercase tracking-wider rounded-xs font-bold"
              >
                Confirm Complete Reset
              </button>
              <button
                onClick={() => setResetConfirm(false)}
                className="px-3 py-2 border border-white/10 text-white/60 hover:text-white text-xs font-mono uppercase rounded-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setResetConfirm(true)}
              className="px-4 py-2 border border-red-900/50 text-red-400 hover:bg-red-950/20 text-xs font-mono uppercase tracking-wider rounded-xs flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Reset Local Data
            </button>
          )}
        </div>
      </div>

      {/* Ethical & Safety Disclaimers */}
      <div className="border border-white/10 bg-[#050508]/90 p-6 rounded-xs space-y-3">
        <div className="flex items-center gap-2 text-red-400 text-xs font-mono uppercase font-bold">
          <ShieldAlert className="w-4 h-4" />
          Safety, Medical & Ethical Guardrails
        </div>

        <ul className="text-xs text-white/70 space-y-2 font-light font-sans leading-relaxed">
          <li>
            • <strong className="text-white">Non-Clinical Instrument:</strong> Quadra-M.I.N.D. Sight is a reflective metacognitive training framework. It is not medical treatment, psychotherapy, or a diagnostic tool for psychiatric or neurological disorders.
          </li>
          <li>
            • <strong className="text-white">Epistemological Humility:</strong> The system does not claim proof of paranormal, metaphysical, or supernatural phenomena. All experiences are examined as products of subjective neural assembly and predictive inference.
          </li>
          <li>
            • <strong className="text-white">Epilepsy & Auditory Sensitivity:</strong> Individuals with a history of seizures, epilepsy, or acute auditory hypersensitivity should consult a healthcare professional before using rhythmic acoustic entrainment.
          </li>
          <li>
            • <strong className="text-white">User Sovereignty:</strong> You retain complete agency over your reflections. If at any moment you experience emotional disorientation, engage the permanent <button onClick={onOpenGroundModal} className="text-red-400 underline">Ground / Exit</button> control to return to physical baseline.
          </li>
        </ul>
      </div>

      {/* Version & Credits */}
      <div className="text-[10px] font-mono text-white/40 space-y-1 pt-4 border-t border-white/5">
        <p>Quadra-M.I.N.D. Sight v1.0.0 — Production Build</p>
        <p>Engineered for high-order metacognition, Socratic dialectic, and psychoacoustic exploration.</p>
      </div>
    </div>
  );
};
