/**
 * FastField Theoretical VTA (Volume of Tissue Activated) Approximation Model
 *
 * Based on clinical DBS bioelectric field literature:
 * - Buchs et al. (2019): FastField: Fast approximation of DBS electric fields.
 * - Dembek et al. (2017): Directional DBS programming & VTA steering.
 * - Åström et al. (2015): Relationship between stimulation amplitude, pulse width, and VTA.
 *
 * DISCLAIMER: For educational & programming reference visualization only.
 * NOT FOR DIRECT CLINICAL SURGICAL NAVIGATION OR DOSIMETRY.
 */

import { ProgramSettings } from '../types/dbs';
import {
  CONTACT_METADATA_LEFT,
  LEAD_RADIUS_MM,
  SEGMENT_ANGLES_DEG,
} from './dbsConstants';

export interface VTAComponent {
  center: [number, number, number]; // [x, y, z] in mm
  radii: [number, number, number];  // [rx, ry, rz] semi-axes in mm
  rotationYRad: number;             // orientation angle
  weight: number;
}

export interface VTAModelResult {
  volumeMm3: number;
  effectiveRadiusMm: number;
  centerMm: [number, number, number];
  isMonopolar: boolean;
  activeCathodeIndices: number[];
  activeAnodeIndices: number[];
  casePolarity: 0 | 'n' | 'p';
  directionalBias: {
    x: number;
    z: number;
    magnitudeMm: number;
    angleDeg: number;
  };
  components: VTAComponent[];
}

export function computeTheoreticalVTA(
  program: ProgramSettings,
  leadRotationDeg = 0
): VTAModelResult {
  const amp = Math.max(0, parseFloat(program.amp) || 0);
  const pw = Math.max(10, parseFloat(program.pw) || 60);
  const casePol = program.cs;

  // Identify active cathodes (n = -) and anodes (p = +)
  const activeCathodes: number[] = [];
  const activeAnodes: number[] = [];

  program.c.forEach((pol, idx) => {
    if (pol === 'n') activeCathodes.push(idx);
    if (pol === 'p') activeAnodes.push(idx);
  });

  // If no stimulation or no cathode/anode active
  if (amp <= 0 || (activeCathodes.length === 0 && activeAnodes.length === 0)) {
    return {
      volumeMm3: 0,
      effectiveRadiusMm: 0,
      centerMm: [0, 0, 0],
      isMonopolar: casePol === 'p' || casePol === 'n',
      activeCathodeIndices: [],
      activeAnodeIndices: [],
      casePolarity: casePol,
      directionalBias: { x: 0, z: 0, magnitudeMm: 0, angleDeg: 0 },
      components: [],
    };
  }

  // Monopolar if case is anode (+) or cathode (-), or if only 1 polarity on lead without matching pole
  const isMonopolar = casePol === 'p' || (casePol === 0 && activeAnodes.length === 0);

  // Pulse width scaling factor relative to standard 60µs
  // Using chronaxie-rheobase relationship for myelinated axons (tau ~ 30-50µs)
  const pwFactor = Math.pow(pw / 60, 0.28);

  // Base activation radius model:
  // For monopolar stimulation: r ≈ r0 + k * sqrt(I)
  // At 3.0 mA, 60µs: typical clinical VTA radius ~ 2.6 - 3.2 mm
  // Volume: V ≈ 4/3 * pi * r^3 ~ 70 - 140 mm³
  const kMonopolar = 1.35;
  const kBipolar = 0.95; // Bipolar fields are tighter and more localized

  const kScale = isMonopolar ? kMonopolar : kBipolar;
  const baseRadiusMm = (LEAD_RADIUS_MM + kScale * Math.sqrt(amp) * pwFactor);

  // Calculate component centers for active cathodes (or anodes if no cathode)
  const primaryElectrodes = activeCathodes.length > 0 ? activeCathodes : activeAnodes;
  const components: VTAComponent[] = [];

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let totalWeight = 0;

  primaryElectrodes.forEach((contactIdx) => {
    const meta = CONTACT_METADATA_LEFT[contactIdx];
    let yMm = meta.heightMm;

    let xMm = 0;
    let zMm = 0;
    let rotRad = 0;
    let rx = baseRadiusMm;
    let ry = baseRadiusMm * 0.95;
    let rz = baseRadiusMm;

    if (!meta.isRing) {
      // Directional contact (Level 2 or 3)
      // Angle around lead axis, taking into account lead rotation offset
      const segmentAngleDeg = (meta.angleDeg + leadRotationDeg) % 360;
      rotRad = (segmentAngleDeg * Math.PI) / 180;

      // Radial displacement towards the segment face
      // Directional steering shifts center outward ~ 0.55 - 0.9 mm
      const directionalShiftMm = Math.min(baseRadiusMm * 0.45, 0.75 + amp * 0.1);
      xMm = directionalShiftMm * Math.sin(rotRad);
      zMm = directionalShiftMm * Math.cos(rotRad);

      // Elongate slightly in the direction of activation, flatter perpendicular
      rx = baseRadiusMm * 1.15;
      rz = baseRadiusMm * 0.85;
    } else {
      // Ring contact: symmetric around lead axis
      rx = baseRadiusMm;
      rz = baseRadiusMm;
      ry = baseRadiusMm * 1.05;
    }

    // If bipolar, adjust shape towards anode(s)
    if (!isMonopolar && activeAnodes.length > 0) {
      const avgAnodeY =
        activeAnodes.reduce((acc, idx) => acc + CONTACT_METADATA_LEFT[idx].heightMm, 0) /
        activeAnodes.length;
      // Pull slightly towards anode on Y axis
      const yDelta = avgAnodeY - yMm;
      yMm += yDelta * 0.15;
      ry *= 0.85; // compressed
    }

    const weight = 1 / primaryElectrodes.length;
    sumX += xMm * weight;
    sumY += yMm * weight;
    sumZ += zMm * weight;
    totalWeight += weight;

    components.push({
      center: [xMm, yMm, zMm],
      radii: [rx, ry, rz],
      rotationYRad: rotRad,
      weight,
    });
  });

  const centerMm: [number, number, number] = [
    totalWeight > 0 ? sumX / totalWeight : 0,
    totalWeight > 0 ? sumY / totalWeight : 0,
    totalWeight > 0 ? sumZ / totalWeight : 0,
  ];

  // Directional bias vector in X-Z plane
  const biasMagnitudeMm = Math.hypot(centerMm[0], centerMm[2]);
  let biasAngleDeg = (Math.atan2(centerMm[0], centerMm[2]) * 180) / Math.PI;
  if (biasAngleDeg < 0) biasAngleDeg += 360;

  // Approximate total volume of the combined VTA
  // For single contact: (4/3) * pi * rx * ry * rz
  // For multiple contacts: merged volume with overlap correction
  let totalVolumeMm3 = 0;
  components.forEach((comp) => {
    const singleVol = (4 / 3) * Math.PI * comp.radii[0] * comp.radii[1] * comp.radii[2];
    totalVolumeMm3 += singleVol * comp.weight;
  });

  // If multiple contacts active, overlap increases volume by sublinear factor
  if (components.length > 1) {
    totalVolumeMm3 *= Math.pow(components.length, 0.42);
  }

  // Deduct lead volume inside the VTA (lead shaft does not activate brain tissue)
  const leadCoreExcludedVol = Math.PI * Math.pow(LEAD_RADIUS_MM, 2) * (baseRadiusMm * 2);
  totalVolumeMm3 = Math.max(0, totalVolumeMm3 - leadCoreExcludedVol * 0.6);

  return {
    volumeMm3: parseFloat(totalVolumeMm3.toFixed(1)),
    effectiveRadiusMm: parseFloat(baseRadiusMm.toFixed(2)),
    centerMm: [
      parseFloat(centerMm[0].toFixed(2)),
      parseFloat(centerMm[1].toFixed(2)),
      parseFloat(centerMm[2].toFixed(2)),
    ],
    isMonopolar,
    activeCathodeIndices: activeCathodes,
    activeAnodeIndices: activeAnodes,
    casePolarity: casePol,
    directionalBias: {
      x: parseFloat(centerMm[0].toFixed(2)),
      z: parseFloat(centerMm[2].toFixed(2)),
      magnitudeMm: parseFloat(biasMagnitudeMm.toFixed(2)),
      angleDeg: parseFloat(biasAngleDeg.toFixed(1)),
    },
    components,
  };
}
