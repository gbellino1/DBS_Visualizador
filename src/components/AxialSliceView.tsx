/**
 * 2D Axial Cross-Section (120° Directional Steering View)
 * Displays the 3 directional contact segments (120° each) at Level 2 (R2) or Level 3 (R3),
 * along with anatomical axes (Anterior, Posterior, Medial, Lateral), lead rotation,
 * and the theoretical VTA steering contour.
 */

import React from 'react';
import { ContactInfo, Polarity, ProgramSettings } from '../types/dbs';
import {
  COLOR_ANODE,
  COLOR_CATHODE,
  COLOR_METAL,
  CONTACT_METADATA_LEFT,
  CONTACT_METADATA_RIGHT,
} from '../utils/dbsConstants';
import { VTAModelResult } from '../utils/vtaModel';

interface AxialSliceViewProps {
  hemisphere: 'L' | 'R';
  level: 2 | 3; // Directional levels (R2 or R3)
  program: ProgramSettings;
  vtaMetrics: VTAModelResult | null;
  leadRotationDeg: number;
  onContactClick?: (contactIndex: number) => void;
  className?: string;
}

export const AxialSliceView: React.FC<AxialSliceViewProps> = ({
  hemisphere,
  level,
  program,
  vtaMetrics,
  leadRotationDeg,
  onContactClick,
  className = '',
}) => {
  const meta = hemisphere === 'L' ? CONTACT_METADATA_LEFT : CONTACT_METADATA_RIGHT;

  // Find contacts for the given level
  const levelContacts = meta.filter((c) => c.level === level);

  // SVG dimensions
  const size = 180;
  const center = size / 2;
  const outerR = 64;
  const innerR = 40;
  const leadR = 26;

  // Anatomical orientations
  const isLeft = hemisphere === 'L';
  const labelTop = 'A (Ant)';
  const labelBottom = 'P (Post)';
  const labelLeft = isLeft ? 'L (Lat)' : 'M (Med)';
  const labelRight = isLeft ? 'M (Med)' : 'L (Lat)';

  // Build 120° segmented arc paths
  // Segment 0: 0° (Anterior)
  // Segment 1: 120°
  // Segment 2: 240°
  // With 15° gap between segments
  const arcLengthDeg = 105;
  const segmentAngles = [0, 120, 240];

  return (
    <div className={`bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col items-center select-none ${className}`}>
      <div className="flex items-center justify-between w-full mb-1 text-xs">
        <span className="font-semibold text-slate-200">
          Corte Axial · Nivel R{hemisphere === 'L' ? level : level + 4} (120°)
        </span>
        <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
          Rot: {leadRotationDeg}°
        </span>
      </div>

      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          <defs>
            {/* Radial gradient for VTA cross section glow */}
            <radialGradient id="vtaGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.7" />
              <stop offset="65%" stopColor="#0d9488" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0f766e" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Coordinate crosshair lines */}
          <line x1={center} y1={12} x2={center} y2={size - 12} stroke="#334155" strokeDasharray="2,2" strokeWidth="1" />
          <line x1={12} y1={center} x2={size - 12} y2={center} stroke="#334155" strokeDasharray="2,2" strokeWidth="1" />

          {/* Theoretical VTA projection slice in axial plane */}
          {vtaMetrics && vtaMetrics.volumeMm3 > 0 && (
            <g
              transform={`translate(${center + vtaMetrics.directionalBias.x * 12}, ${
                center - vtaMetrics.directionalBias.z * 12
              })`}
            >
              <circle
                r={Math.min(75, Math.max(20, vtaMetrics.effectiveRadiusMm * 14))}
                fill="url(#vtaGlow)"
              />
              <circle
                r={Math.min(75, Math.max(20, vtaMetrics.effectiveRadiusMm * 14))}
                fill="none"
                stroke="#2dd4bf"
                strokeWidth="1.2"
                strokeDasharray="3,3"
                opacity="0.8"
              />
            </g>
          )}

          {/* Anatomical labels */}
          <text x={center} y={10} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">
            {labelTop}
          </text>
          <text x={center} y={size} fill="#94a3b8" fontSize="10" textAnchor="middle">
            {labelBottom}
          </text>
          <text x={8} y={center + 3} fill="#94a3b8" fontSize="9" textAnchor="start">
            {labelLeft}
          </text>
          <text x={size - 8} y={center + 3} fill="#a78bfa" fontSize="9" textAnchor="end">
            {labelRight}
          </text>

          {/* Lead outer & inner shaft */}
          <circle cx={center} cy={center} r={leadR} fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          {/* Inner core */}
          <circle cx={center} cy={center} r={innerR * 0.4} fill="#0f172a" />

          {/* 3 Directional Segments (Group rotated with leadRotationDeg) */}
          <g transform={`rotate(${leadRotationDeg}, ${center}, ${center})`}>
            {levelContacts.map((contact, i) => {
              const baseAngleDeg = segmentAngles[i];
              const pol = program.c[contact.index];
              const isCathode = pol === 'n';
              const isAnode = pol === 'p';

              // Segment fill color
              const fillColor = isCathode ? COLOR_CATHODE : isAnode ? COLOR_ANODE : '#334155';
              const strokeColor = isCathode ? '#5eead4' : isAnode ? '#fcd34d' : '#64748b';

              const d = describeDonutArc(center, center, innerR, outerR, baseAngleDeg - arcLengthDeg / 2, baseAngleDeg + arcLengthDeg / 2);

              // Center point of arc for label
              const labelAngleRad = ((baseAngleDeg - 90) * Math.PI) / 180;
              const labelR = (innerR + outerR) / 2;
              const lx = center + labelR * Math.cos(labelAngleRad);
              const ly = center + labelR * Math.sin(labelAngleRad);

              return (
                <g
                  key={contact.index}
                  className="cursor-pointer transition-transform hover:opacity-90 active:scale-95"
                  onClick={() => onContactClick && onContactClick(contact.index)}
                >
                  <path
                    d={d}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    className="transition-colors duration-150"
                  />
                  {/* Contact number inside segment */}
                  <text
                    x={lx}
                    y={ly + 3}
                    fill={pol !== 0 ? '#ffffff' : '#e2e8f0'}
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {contact.globalNumber}
                    {pol === 'n' ? ' (−)' : pol === 'p' ? ' (+)' : ''}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Steering vector indicator */}
          {vtaMetrics && vtaMetrics.directionalBias.magnitudeMm > 0.3 && (
            <line
              x1={center}
              y1={center}
              x2={center + vtaMetrics.directionalBias.x * 24}
              y2={center - vtaMetrics.directionalBias.z * 24}
              stroke="#38bdf8"
              strokeWidth="2.5"
              markerEnd="url(#arrow)"
            />
          )}
        </svg>
      </div>

      <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between w-full">
        <span>Contactos: {levelContacts.map((c) => c.globalNumber).join(', ')}</span>
        <span className="text-teal-400">Clic en arco para alternar</span>
      </div>
    </div>
  );
};

// Helper to draw SVG donut arc segment
function describeDonutArc(
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  // SVG angles: 0 is right (3 o'clock). We want 0 to be top (12 o'clock, Anterior)
  const startRad = ((startAngleDeg - 90) * Math.PI) / 180;
  const endRad = ((endAngleDeg - 90) * Math.PI) / 180;

  const x1Outer = x + outerRadius * Math.cos(startRad);
  const y1Outer = y + outerRadius * Math.sin(startRad);
  const x2Outer = x + outerRadius * Math.cos(endRad);
  const y2Outer = y + outerRadius * Math.sin(endRad);

  const x1Inner = x + innerRadius * Math.cos(endRad);
  const y1Inner = y + innerRadius * Math.sin(endRad);
  const x2Inner = x + innerRadius * Math.cos(startRad);
  const y2Inner = y + innerRadius * Math.sin(startRad);

  const largeArc = endAngleDeg - startAngleDeg <= 180 ? 0 : 1;

  return [
    `M ${x1Outer} ${y1Outer}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
    `L ${x1Inner} ${y1Inner}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
    'Z',
  ].join(' ');
}
