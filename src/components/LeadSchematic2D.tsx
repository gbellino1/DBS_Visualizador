/**
 * 2D Interactive Lead Schematic (1-3-3-1 Layout)
 * R4: 1 ring contact
 * R3: 3 directional contacts (120°)
 * R2: 3 directional contacts (120°)
 * R1: 1 ring contact
 */

import React from 'react';
import { Polarity, ProgramSettings } from '../types/dbs';
import {
  COLOR_ANODE,
  COLOR_CATHODE,
  CONTACT_METADATA_LEFT,
  CONTACT_METADATA_RIGHT,
} from '../utils/dbsConstants';

interface LeadSchematic2DProps {
  hemisphere: 'L' | 'R';
  program: ProgramSettings;
  onContactToggle: (contactIndex: number) => void;
  className?: string;
}

export const LeadSchematic2D: React.FC<LeadSchematic2DProps> = ({
  hemisphere,
  program,
  onContactToggle,
  className = '',
}) => {
  const meta = hemisphere === 'L' ? CONTACT_METADATA_LEFT : CONTACT_METADATA_RIGHT;

  // Level groupings (from top R4 to bottom R1):
  const r4 = meta.find((c) => c.level === 4)!;
  const r3 = meta.filter((c) => c.level === 3);
  const r2 = meta.filter((c) => c.level === 2);
  const r1 = meta.find((c) => c.level === 1)!;

  const getButtonClass = (pol: Polarity) => {
    if (pol === 'n') {
      return 'bg-teal-500 hover:bg-teal-600 text-white border-teal-400 shadow-sm shadow-teal-500/20';
    }
    if (pol === 'p') {
      return 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400 shadow-sm shadow-amber-500/20';
    }
    return 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:border-slate-600';
  };

  const getSymbol = (pol: Polarity) => {
    if (pol === 'n') return '−';
    if (pol === 'p') return '+';
    return '·';
  };

  return (
    <div className={`flex flex-col items-center bg-slate-900/60 p-3 rounded-xl border border-slate-800 ${className}`}>
      <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between w-full">
        <span>Disposición 1-3-3-1</span>
        <span className="text-slate-400 text-[10px]">Proximal (R4) → Distal (R1)</span>
      </div>

      {/* Vertical Lead Column */}
      <div className="relative w-full max-w-[260px] flex flex-col items-center gap-2 py-2">
        {/* Shaft background line */}
        <div className="absolute top-0 bottom-0 w-2.5 bg-slate-700/60 rounded-full -z-0" />

        {/* Level 4: R4 Ring (Top) */}
        <div className="w-full z-10 flex flex-col items-center">
          <div className="flex items-center justify-between w-full text-[10px] text-slate-400 px-1 mb-0.5">
            <span className="font-mono">R{hemisphere === 'L' ? '4' : '8'} (Anular)</span>
            <span>360°</span>
          </div>
          <button
            type="button"
            onClick={() => onContactToggle(r4.index)}
            className={`w-full py-2 px-3 rounded-lg border font-semibold text-sm transition-all duration-150 flex items-center justify-between cursor-pointer ${getButtonClass(
              program.c[r4.index]
            )}`}
          >
            <span className="font-mono text-xs">C{r4.globalNumber}</span>
            <span className="text-base font-bold">{getSymbol(program.c[r4.index])}</span>
            <span className="text-[10px] opacity-80 uppercase">
              {program.c[r4.index] === 'n' ? 'Cátodo' : program.c[r4.index] === 'p' ? 'Ánodo' : 'Off'}
            </span>
          </button>
        </div>

        {/* Level 3: R3 Directional (3 segments at 120°) */}
        <div className="w-full z-10 flex flex-col items-center mt-1">
          <div className="flex items-center justify-between w-full text-[10px] text-slate-400 px-1 mb-0.5">
            <span className="font-mono">R{hemisphere === 'L' ? '3' : '7'} (Direccional)</span>
            <span>3 × 120°</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 w-full">
            {r3.map((contact, segIdx) => {
              const segLabel = segIdx === 0 ? 'A' : segIdx === 1 ? 'B' : 'C';
              const pol = program.c[contact.index];
              return (
                <button
                  key={contact.index}
                  type="button"
                  onClick={() => onContactToggle(contact.index)}
                  className={`py-2 px-1.5 rounded-lg border font-semibold text-xs flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${getButtonClass(
                    pol
                  )}`}
                  title={`Contacto ${contact.globalNumber} (Segmento ${segLabel})`}
                >
                  <span className="font-mono text-[10px]">C{contact.globalNumber}</span>
                  <span className="text-sm font-bold my-0.5">{getSymbol(pol)}</span>
                  <span className="text-[9px] opacity-75 font-mono">{segLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Level 2: R2 Directional (3 segments at 120°) */}
        <div className="w-full z-10 flex flex-col items-center mt-1">
          <div className="flex items-center justify-between w-full text-[10px] text-slate-400 px-1 mb-0.5">
            <span className="font-mono">R{hemisphere === 'L' ? '2' : '6'} (Direccional)</span>
            <span>3 × 120°</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 w-full">
            {r2.map((contact, segIdx) => {
              const segLabel = segIdx === 0 ? 'A' : segIdx === 1 ? 'B' : 'C';
              const pol = program.c[contact.index];
              return (
                <button
                  key={contact.index}
                  type="button"
                  onClick={() => onContactToggle(contact.index)}
                  className={`py-2 px-1.5 rounded-lg border font-semibold text-xs flex flex-col items-center justify-center transition-all duration-150 cursor-pointer ${getButtonClass(
                    pol
                  )}`}
                  title={`Contacto ${contact.globalNumber} (Segmento ${segLabel})`}
                >
                  <span className="font-mono text-[10px]">C{contact.globalNumber}</span>
                  <span className="text-sm font-bold my-0.5">{getSymbol(pol)}</span>
                  <span className="text-[9px] opacity-75 font-mono">{segLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Level 1: R1 Ring (Bottom / Distal) */}
        <div className="w-full z-10 flex flex-col items-center mt-1">
          <div className="flex items-center justify-between w-full text-[10px] text-slate-400 px-1 mb-0.5">
            <span className="font-mono">R{hemisphere === 'L' ? '1' : '5'} (Anular Punta)</span>
            <span>360°</span>
          </div>
          <button
            type="button"
            onClick={() => onContactToggle(r1.index)}
            className={`w-full py-2 px-3 rounded-lg border font-semibold text-sm transition-all duration-150 flex items-center justify-between cursor-pointer ${getButtonClass(
              program.c[r1.index]
            )}`}
          >
            <span className="font-mono text-xs">C{r1.globalNumber}</span>
            <span className="text-base font-bold">{getSymbol(program.c[r1.index])}</span>
            <span className="text-[10px] opacity-80 uppercase">
              {program.c[r1.index] === 'n' ? 'Cátodo' : program.c[r1.index] === 'p' ? 'Ánodo' : 'Off'}
            </span>
          </button>
        </div>
      </div>

      <div className="text-[10px] text-slate-400 mt-2 text-center">
        Clic para alternar: <span className="text-slate-300">Apagado</span> → <span className="text-teal-400">Cátodo (−)</span> → <span className="text-amber-400">Ánodo (+)</span>
      </div>
    </div>
  );
};
