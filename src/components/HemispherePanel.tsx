/**
 * Hemisphere Programming Panel
 * Controls Target, Interleaving (P1/P2), Lead Rotation, Parameters,
 * 1-3-3-1 Schematic, and links with the 3D Viewer.
 */

import React, { useState } from 'react';
import { HemisphereState, Polarity, ProgramSettings } from '../types/dbs';
import { LeadSchematic2D } from './LeadSchematic2D';
import { AxialSliceView } from './AxialSliceView';
import { Dbs3DViewer } from './Dbs3DViewer';
import { computeTheoreticalVTA } from '../utils/vtaModel';
import {
  Brain,
  Sliders,
  Sparkles,
  Zap,
  RotateCw,
  Compass,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';

interface HemispherePanelProps {
  hemisphere: 'L' | 'R';
  state: HemisphereState;
  onChange: (newState: HemisphereState) => void;
  className?: string;
}

export const HemispherePanel: React.FC<HemispherePanelProps> = ({
  hemisphere,
  state,
  onChange,
  className = '',
}) => {
  const [activeProgIdx, setActiveProgIdx] = useState<number>(0);
  const [activeSliceLevel, setActiveSliceLevel] = useState<2 | 3>(2);
  const [viewMode, setViewMode] = useState<'3d' | 'axial'>('3d');

  const isLeft = hemisphere === 'L';
  const hemiName = isLeft ? 'Hemisferio Izquierdo' : 'Hemisferio Derecho';
  const leadLabel = isLeft ? 'Lead 1 (Contactos 1–8)' : 'Lead 2 (Contactos 9–16)';

  const currentProg = state.p[activeProgIdx] || state.p[0];
  const vtaMetrics = computeTheoreticalVTA(currentProg, state.leadRotationDeg);

  // Handlers
  const handleTargetChange = (val: string) => {
    onChange({ ...state, t: val });
  };

  const handleInterleavingToggle = (checked: boolean) => {
    onChange({ ...state, inter: checked });
    if (!checked && activeProgIdx === 1) {
      setActiveProgIdx(0);
    }
  };

  const handleRotationChange = (deg: number) => {
    onChange({ ...state, leadRotationDeg: deg });
  };

  const updateCurrentProg = (updates: Partial<ProgramSettings>) => {
    const newProgs = [...state.p];
    newProgs[activeProgIdx] = {
      ...newProgs[activeProgIdx],
      ...updates,
    };
    onChange({ ...state, p: newProgs });
  };

  const handleContactToggle = (contactIdx: number) => {
    const currentPol = currentProg.c[contactIdx];
    // 0 -> 'n' (-) -> 'p' (+) -> 0
    const nextPol: Polarity = currentPol === 0 ? 'n' : currentPol === 'n' ? 'p' : 0;
    const newContacts = [...currentProg.c];
    newContacts[contactIdx] = nextPol;
    updateCurrentProg({ c: newContacts });
  };

  // Quick preset loader
  const applyPreset = (type: 'monopolar_r1' | 'dir_anterior' | 'dir_lateral' | 'bipolar') => {
    const emptyC: Polarity[] = Array(8).fill(0);
    if (type === 'monopolar_r1') {
      emptyC[0] = 'n'; // R1 ring negative
      updateCurrentProg({ c: emptyC, cs: 'p', amp: '2.50', pw: '60', hz: '130' });
    } else if (type === 'dir_anterior') {
      emptyC[1] = 'n'; // R2-A (Anterior) negative
      updateCurrentProg({ c: emptyC, cs: 'p', amp: '2.80', pw: '60', hz: '130' });
    } else if (type === 'dir_lateral') {
      emptyC[2] = 'n'; // R2-B (Postero-Lateral) negative
      updateCurrentProg({ c: emptyC, cs: 'p', amp: '2.40', pw: '60', hz: '130' });
    } else if (type === 'bipolar') {
      emptyC[1] = 'n'; // R2-A negative
      emptyC[4] = 'p'; // R3-A positive
      updateCurrentProg({ c: emptyC, cs: 0, amp: '3.20', pw: '60', hz: '130' });
    }
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col gap-4 shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${isLeft ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">{hemiName}</h2>
            <p className="text-xs text-slate-400 font-mono">{leadLabel}</p>
          </div>
        </div>

        {/* Target and Interleaving controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
            <label className="text-xs text-slate-400">Target:</label>
            <input
              type="text"
              value={state.t}
              onChange={(e) => handleTargetChange(e.target.value)}
              placeholder="STN"
              className="bg-slate-900 text-white font-semibold text-xs px-2 py-0.5 rounded border border-slate-700 w-20 focus:outline-none focus:border-cyan-500"
            />
            {['STN', 'GPi', 'VIM'].map((tVal) => (
              <button
                key={tVal}
                type="button"
                onClick={() => handleTargetChange(tVal)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  state.t === tVal ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800'
                }`}
              >
                {tVal}
              </button>
            ))}
          </div>

          {/* Interleaving Checkbox */}
          <label className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60 cursor-pointer text-xs text-slate-300 hover:bg-slate-800 transition-colors">
            <input
              type="checkbox"
              checked={state.inter}
              onChange={(e) => handleInterleavingToggle(e.target.checked)}
              className="rounded text-cyan-500 focus:ring-0 bg-slate-900 border-slate-700"
            />
            <span className="font-medium">Interleaving (P2)</span>
          </label>
        </div>
      </div>

      {/* Program Selector (P1 / P2) */}
      {state.inter && (
        <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium px-2">Programa activo:</span>
          <button
            type="button"
            onClick={() => setActiveProgIdx(0)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeProgIdx === 0
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            Programa P1
          </button>
          <button
            type="button"
            onClick={() => setActiveProgIdx(1)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeProgIdx === 1
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            Programa P2 (Interleaved)
          </button>
        </div>
      )}

      {/* Main Grid: 3D Visualizer & Lead Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: 3D DBS & VTA Visualizer (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                Visualización 3D & Campo VTA
              </span>
            </div>

            {/* Switch between 3D and 2D Axial Slice */}
            <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode('3d')}
                className={`px-2 py-0.5 rounded font-medium ${
                  viewMode === '3d' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                3D Completo
              </button>
              <button
                type="button"
                onClick={() => setViewMode('axial')}
                className={`px-2 py-0.5 rounded font-medium ${
                  viewMode === 'axial' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Corte Axial 120°
              </button>
            </div>
          </div>

          {viewMode === '3d' ? (
            <Dbs3DViewer
              hemisphere={hemisphere}
              programIndex={activeProgIdx}
              program={currentProg}
              leadRotationDeg={state.leadRotationDeg}
              onLeadRotationChange={handleRotationChange}
              onContactClick={handleContactToggle}
              targetName={state.t}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 bg-slate-900 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300">Nivel de corte:</span>
                <button
                  type="button"
                  onClick={() => setActiveSliceLevel(2)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    activeSliceLevel === 2 ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Nivel R2 (Contactos {isLeft ? '2, 3, 4' : '10, 11, 12'})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSliceLevel(3)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold ${
                    activeSliceLevel === 3 ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Nivel R3 (Contactos {isLeft ? '5, 6, 7' : '13, 14, 15'})
                </button>
              </div>
              <AxialSliceView
                hemisphere={hemisphere}
                level={activeSliceLevel}
                program={currentProg}
                vtaMetrics={vtaMetrics}
                leadRotationDeg={state.leadRotationDeg}
                onContactClick={handleContactToggle}
              />
            </div>
          )}

          {/* Theoretical VTA FastField Info Card */}
          <div className="bg-slate-950/70 border border-teal-500/20 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  VTA Teórico (FastField):{' '}
                  <span className="text-teal-400 font-mono text-sm font-bold">
                    {vtaMetrics.volumeMm3} mm³
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Radio aprox: <span className="text-slate-300 font-mono">{vtaMetrics.effectiveRadiusMm} mm</span> |{' '}
                  Configuración:{' '}
                  <span className="text-slate-300 font-medium">
                    {vtaMetrics.isMonopolar ? 'Monopolar' : 'Bipolar'}
                  </span>
                </div>
              </div>
            </div>

            {vtaMetrics.directionalBias.magnitudeMm > 0.3 && (
              <div className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-right">
                <div className="text-[10px] text-slate-400">Desplazamiento Direccional</div>
                <div className="font-mono text-cyan-300 font-bold text-xs">
                  {vtaMetrics.directionalBias.magnitudeMm} mm @ {vtaMetrics.directionalBias.angleDeg}°
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 1-3-3-1 Matrix & Stimulation Parameters (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Quick Presets Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <span className="text-slate-400 text-[10px] uppercase font-bold shrink-0">Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset('monopolar_r1')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 whitespace-nowrap"
            >
              R1 Anular
            </button>
            <button
              type="button"
              onClick={() => applyPreset('dir_anterior')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 whitespace-nowrap"
            >
              Dir Ant (R2-A)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('dir_lateral')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 whitespace-nowrap"
            >
              Dir Lat (R2-B)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('bipolar')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 whitespace-nowrap"
            >
              Bipolar
            </button>
          </div>

          {/* 1-3-3-1 Interactive Lead Layout */}
          <LeadSchematic2D
            hemisphere={hemisphere}
            program={currentProg}
            onContactToggle={handleContactToggle}
          />

          {/* Stimulation Parameters Form */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3 text-xs">
            <div className="font-bold text-slate-200 flex items-center justify-between">
              <span>Parámetros de Estimulación</span>
              <span className="text-[11px] text-cyan-400 font-mono">P{activeProgIdx + 1}</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Amplitud */}
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <label className="text-[11px] text-slate-400 block mb-1">Amplitud (mA)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="10"
                    value={currentProg.amp}
                    onChange={(e) => updateCurrentProg({ amp: e.target.value })}
                    className="w-full bg-slate-950 text-white font-mono font-bold text-base px-2 py-1 rounded border border-slate-700 focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-slate-400 font-mono text-xs">mA</span>
                </div>
              </div>

              {/* Ancho de Pulso */}
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <label className="text-[11px] text-slate-400 block mb-1">Ancho Pulso (µs)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="10"
                    min="10"
                    max="450"
                    value={currentProg.pw}
                    onChange={(e) => updateCurrentProg({ pw: e.target.value })}
                    className="w-full bg-slate-950 text-white font-mono font-bold text-base px-2 py-1 rounded border border-slate-700 focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-slate-400 font-mono text-xs">µs</span>
                </div>
              </div>

              {/* Frecuencia */}
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <label className="text-[11px] text-slate-400 block mb-1">Frecuencia (Hz)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="5"
                    min="2"
                    max="250"
                    value={currentProg.hz}
                    onChange={(e) => updateCurrentProg({ hz: e.target.value })}
                    className="w-full bg-slate-950 text-white font-mono font-bold text-base px-2 py-1 rounded border border-slate-700 focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-slate-400 font-mono text-xs">Hz</span>
                </div>
              </div>

              {/* Carcasa (Case) */}
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <label className="text-[11px] text-slate-400 block mb-1">Carcasa (IPG Case)</label>
                <select
                  value={String(currentProg.cs)}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateCurrentProg({ cs: val === '0' ? 0 : (val as Polarity) });
                  }}
                  className="w-full bg-slate-950 text-white font-semibold text-xs px-2 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="0">Apagada (Bipolar)</option>
                  <option value="p">Ánodo (+) [Monopolar]</option>
                  <option value="n">Cátodo (−)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
