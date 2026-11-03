/**
 * Types and definitions for DBS 1-3-3-1 Directional Lead Programming
 */

export type Polarity = 0 | 'n' | 'p'; // 0 = off, 'n' = negative (- / cathode), 'p' = positive (+ / anode)

export interface ProgramSettings {
  c: Polarity[];       // 8 contacts per lead
  cs: Polarity;        // Case / Carcasa (0, 'n', 'p')
  amp: string;         // Amplitude (mA), e.g. "3.20"
  pw: string;          // Pulse width (µs), e.g. "60"
  hz: string;          // Frequency (Hz), e.g. "130"
}

export interface HemisphereState {
  t: string;           // Target (STN, GPi, VIM, etc.)
  inter: boolean;      // Interleaving enabled (2nd program)
  p: ProgramSettings[]; // [P1, P2]
  leadRotationDeg: number; // Implantation angle offset (0-360°)
}

export interface DBSState {
  patientId: string;
  date: string;
  notes: string;
  L: HemisphereState;
  R: HemisphereState;
}

export interface ContactInfo {
  index: number;         // 0 to 7 (or 0 to 15)
  leadIndex: number;     // 1 to 8 (Lead local)
  globalNumber: number;  // 1 to 8 (Left) or 9 to 16 (Right)
  level: number;         // 1 (R1 distal), 2 (R2 segmented), 3 (R3 segmented), 4 (R4 proximal)
  isRing: boolean;       // true for R1 and R4
  segmentIndex?: number; // 0, 1, 2 for directional contacts
  angleDeg: number;      // 0 for ring; 90, 210, 330 for segmented
  label: string;         // "C1", "C2", etc.
  heightMm: number;      // Y position along lead in mm (-2.25, -0.75, +0.75, +2.25)
}

export interface VTAMetrics {
  volumeMm3: number;
  radiusMm: number;
  centerMm: [number, number, number]; // [x, y, z] center of activation in mm
  isMonopolar: boolean;
  activeCathodesCount: number;
  activeAnodesCount: number;
  directionalBias: { x: number; z: number; magnitude: number; angleDeg: number };
}
