/**
 * DBS 1-3-3-1 Directional Lead Geometric Constants & Helpers
 * Standard dimensions based on clinical 8-contact directional leads (Boston Scientific Vercise Cartesia / Abbott Infinity):
 * - Lead diameter: 1.27 mm (radius 0.635 mm)
 * - Contact height: 1.5 mm
 * - Inter-contact spacing: 0.5 mm
 * - 4 vertical levels (distal R1 to proximal R4)
 * - Level 1 (R1): 360° Ring (Distal)
 * - Level 2 (R2): 3 Directional Segments (120° each: A, B, C)
 * - Level 3 (R3): 3 Directional Segments (120° each: A, B, C)
 * - Level 4 (R4): 360° Ring (Proximal)
 */

import { ContactInfo } from '../types/dbs';

export const LEAD_RADIUS_MM = 0.635;
export const CONTACT_HEIGHT_MM = 1.5;
export const CONTACT_SPACING_MM = 0.5;
export const LEVEL_PITCH_MM = CONTACT_HEIGHT_MM + CONTACT_SPACING_MM; // 2.0 mm center-to-center

// Y-centers for each level (0 is mid-point between Level 2 and Level 3)
export const LEVEL_Y_POSITIONS = {
  1: -1.5 * LEVEL_PITCH_MM, // -3.0 mm (R1 distal ring)
  2: -0.5 * LEVEL_PITCH_MM, // -1.0 mm (R2 directional)
  3: +0.5 * LEVEL_PITCH_MM, // +1.0 mm (R3 directional)
  4: +1.5 * LEVEL_PITCH_MM, // +3.0 mm (R4 proximal ring)
};

// Directional segment angles (relative to Anterior = 0°)
// Segment 1 (e.g. Anterior/Lateral): 0°
// Segment 2 (e.g. Posterior/Lateral): 120°
// Segment 3 (e.g. Medial): 240°
export const SEGMENT_ANGLES_DEG = [0, 120, 240];

export const CONTACT_METADATA_LEFT: ContactInfo[] = [
  // Level 1: R1 (Ring distal)
  { index: 0, leadIndex: 1, globalNumber: 1, level: 1, isRing: true, angleDeg: 0, label: 'C1 (R1)', heightMm: LEVEL_Y_POSITIONS[1] },
  // Level 2: R2 (3 directional segments)
  { index: 1, leadIndex: 2, globalNumber: 2, level: 2, isRing: false, segmentIndex: 0, angleDeg: 0, label: 'C2 (R2-A)', heightMm: LEVEL_Y_POSITIONS[2] },
  { index: 2, leadIndex: 3, globalNumber: 3, level: 2, isRing: false, segmentIndex: 1, angleDeg: 120, label: 'C3 (R2-B)', heightMm: LEVEL_Y_POSITIONS[2] },
  { index: 3, leadIndex: 4, globalNumber: 4, level: 2, isRing: false, segmentIndex: 2, angleDeg: 240, label: 'C4 (R2-C)', heightMm: LEVEL_Y_POSITIONS[2] },
  // Level 3: R3 (3 directional segments)
  { index: 4, leadIndex: 5, globalNumber: 5, level: 3, isRing: false, segmentIndex: 0, angleDeg: 0, label: 'C5 (R3-A)', heightMm: LEVEL_Y_POSITIONS[3] },
  { index: 5, leadIndex: 6, globalNumber: 6, level: 3, isRing: false, segmentIndex: 1, angleDeg: 120, label: 'C6 (R3-B)', heightMm: LEVEL_Y_POSITIONS[3] },
  { index: 6, leadIndex: 7, globalNumber: 7, level: 3, isRing: false, segmentIndex: 2, angleDeg: 240, label: 'C7 (R3-C)', heightMm: LEVEL_Y_POSITIONS[3] },
  // Level 4: R4 (Ring proximal)
  { index: 7, leadIndex: 8, globalNumber: 8, level: 4, isRing: true, angleDeg: 0, label: 'C8 (R4)', heightMm: LEVEL_Y_POSITIONS[4] },
];

export const CONTACT_METADATA_RIGHT: ContactInfo[] = CONTACT_METADATA_LEFT.map((c) => ({
  ...c,
  globalNumber: c.globalNumber + 8,
  label: `C${c.globalNumber + 8} (${c.isRing ? `R${c.level + 4}` : `R${c.level + 4}-${String.fromCharCode(65 + (c.segmentIndex || 0))}`})`,
}));

export const COLOR_CATHODE = '#1fb5ac'; // Teal cyan for negative (-)
export const COLOR_ANODE = '#f59e0b';   // Amber gold for positive (+)
export const COLOR_OFF = '#64748b';     // Neutral slate for off
export const COLOR_METAL = '#e2e8f0';   // Platinum contact metal
export const COLOR_SHAFT = '#f8fafc';   // Translucent polyurethane lead body
