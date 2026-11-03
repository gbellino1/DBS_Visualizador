/**
 * DBS Program Card PNG Exporter
 * Generates a high-resolution, presentation-grade clinical report card (PNG)
 * combining stimulation parameters, 1-3-3-1 lead diagram, 3D VTA render snapshot,
 * and data metrics.
 */

import { DBSState, HemisphereState, ProgramSettings } from '../types/dbs';
import {
  COLOR_ANODE,
  COLOR_CATHODE,
  COLOR_METAL,
  CONTACT_METADATA_LEFT,
  CONTACT_METADATA_RIGHT,
} from './dbsConstants';
import { computeTheoreticalVTA } from './vtaModel';

export interface ExportCardOptions {
  state: DBSState;
  leftSnapshotUrl?: string;
  rightSnapshotUrl?: string;
}

export async function generateCardPNG({
  state,
  leftSnapshotUrl,
  rightSnapshotUrl,
}: ExportCardOptions): Promise<string> {
  const scale = 2; // High-DPI 2x scale for sharp output
  const cardW = 1000;
  const cardH = 720;

  const canvas = document.createElement('canvas');
  canvas.width = cardW * scale;
  canvas.height = cardH * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#0f172a'; // Deep slate navy
  ctx.fillRect(0, 0, cardW, cardH);

  // Header Banner
  const gradient = ctx.createLinearGradient(0, 0, cardW, 0);
  gradient.addColorStop(0, '#0284c7');
  gradient.addColorStop(0.5, '#0d9488');
  gradient.addColorStop(1, '#0369a1');
  ctx.fillStyle = gradient;
  roundRect(ctx, 20, 20, cardW - 40, 68, 12, true, false);

  // Header Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PROGRAMACIÓN DBS · ELECTRODO DIRECCIONAL 1-3-3-1', 40, 50);

  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText(
    `Paciente: ${state.patientId || 'Anónimo'}  |  Fecha: ${state.date}  |  Modelo VTA: FastField Teórico`,
    40,
    72
  );

  // Lead Columns: Left Hemisphere and Right Hemisphere
  const colW = (cardW - 60) / 2; // ~460px each
  const colY = 104;

  // Render Left Hemisphere Card
  await renderHemisphereSection(
    ctx,
    30,
    colY,
    colW,
    520,
    'L',
    state.L,
    state.patientId,
    leftSnapshotUrl
  );

  // Render Right Hemisphere Card
  await renderHemisphereSection(
    ctx,
    30 + colW + 20,
    colY,
    colW,
    520,
    'R',
    state.R,
    state.patientId,
    rightSnapshotUrl
  );

  // Footer / Disclaimer
  ctx.fillStyle = '#64748b';
  ctx.font = '10px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'AVISO: Visualización y VTA estimados mediante modelo bioeléctrico de referencia (FastField). Solo para fines de registro y reporte técnico, no para uso clínico directo.',
    cardW / 2,
    cardH - 16
  );

  return canvas.toDataURL('image/png');
}

async function renderHemisphereSection(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hemiKey: 'L' | 'R',
  hemi: HemisphereState,
  patientId: string,
  snapshotUrl?: string
) {
  const isLeft = hemiKey === 'L';
  const meta = isLeft ? CONTACT_METADATA_LEFT : CONTACT_METADATA_RIGHT;

  // Card background
  roundRect(ctx, x, y, w, h, 12, false, true, '#1e293b', '#334155');

  // Hemisphere Title Header
  roundRect(ctx, x, y, w, 44, [12, 12, 0, 0], true, false, isLeft ? '#0e7490' : '#047857');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `Hemisferio ${isLeft ? 'Izquierdo (Lead 1)' : 'Derecho (Lead 2)'} · Target: ${hemi.t || 'STN'}`,
    x + 16,
    y + 28
  );

  // Active Program (P1)
  const p1 = hemi.p[0];
  const vta1 = computeTheoreticalVTA(p1, hemi.leadRotationDeg);

  // Stimulation parameter boxes on top right
  const paramY = y + 56;
  const paramW = 120;
  const paramH = 50;

  renderParamBox(ctx, x + 16, paramY, paramW, paramH, 'Amplitud', `${parseFloat(p1.amp).toFixed(2)} mA`);
  renderParamBox(ctx, x + 16 + paramW + 10, paramY, paramW, paramH, 'Ancho Pulso', `${p1.pw} µs`);
  renderParamBox(ctx, x + 16 + (paramW + 10) * 2, paramY, paramW, paramH, 'Frecuencia', `${p1.hz} Hz`);

  // Secondary row: Carcasa, Interleaving, VTA Volume
  const row2Y = paramY + paramH + 8;
  const csText = p1.cs === 'p' ? 'Ánodo (+)' : p1.cs === 'n' ? 'Cátodo (−)' : 'Apagada';
  renderParamBox(ctx, x + 16, row2Y, paramW, 42, 'Carcasa', csText, p1.cs === 'p' ? COLOR_ANODE : p1.cs === 'n' ? COLOR_CATHODE : '#94a3b8');
  renderParamBox(ctx, x + 16 + paramW + 10, row2Y, paramW, 42, 'Interleaving', hemi.inter ? 'Sí (P1+P2)' : 'No', hemi.inter ? '#38bdf8' : '#94a3b8');
  renderParamBox(ctx, x + 16 + (paramW + 10) * 2, row2Y, paramW, 42, 'VTA Estimado', `${vta1.volumeMm3} mm³`, '#2dd4bf');

  // Middle section: 3D Snapshot (or Lead representation) + 2D 1-3-3-1 Contact Layout
  const graphicY = row2Y + 54;
  const imgBoxW = 210;
  const imgBoxH = 260;

  // Draw Snapshot image if provided
  if (snapshotUrl) {
    try {
      const img = await loadImage(snapshotUrl);
      ctx.save();
      roundRect(ctx, x + 16, graphicY, imgBoxW, imgBoxH, 8, true, true, '#0b1120', '#334155');
      ctx.drawImage(img, x + 16, graphicY, imgBoxW, imgBoxH);
      ctx.restore();
    } catch {
      drawFallbackLeadDiagram(ctx, x + 16, graphicY, imgBoxW, imgBoxH, p1, meta, hemi.leadRotationDeg);
    }
  } else {
    drawFallbackLeadDiagram(ctx, x + 16, graphicY, imgBoxW, imgBoxH, p1, meta, hemi.leadRotationDeg);
  }

  // Right side of middle section: 1-3-3-1 schematic table
  const tableX = x + 16 + imgBoxW + 16;
  const tableW = w - (16 * 3 + imgBoxW);
  renderContactMatrix(ctx, tableX, graphicY, tableW, imgBoxH, p1, meta);

  // If interleaving is active, show small P2 summary bar at bottom
  if (hemi.inter && hemi.p[1]) {
    const p2 = hemi.p[1];
    const vta2 = computeTheoreticalVTA(p2, hemi.leadRotationDeg);
    const p2Y = graphicY + imgBoxH + 12;
    roundRect(ctx, x + 16, p2Y, w - 32, 48, 6, true, true, '#1e293b', '#0284c7');
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Programa P2 (Interleaving)', x + 24, p2Y + 18);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillText(
      `${parseFloat(p2.amp).toFixed(2)} mA · ${p2.pw} µs · ${p2.hz} Hz | VTA: ${vta2.volumeMm3} mm³`,
      x + 24,
      p2Y + 36
    );
  }
}

function renderParamBox(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  title: string,
  val: string,
  valColor = '#ffffff'
) {
  roundRect(ctx, bx, by, bw, bh, 6, true, true, '#1e293b', '#334155');
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, bx + 10, by + 16);

  ctx.fillStyle = valColor;
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillText(val, bx + 10, by + bh - 10);
}

function renderContactMatrix(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  tw: number,
  th: number,
  p: ProgramSettings,
  meta: typeof CONTACT_METADATA_LEFT
) {
  roundRect(ctx, tx, ty, tw, th, 8, true, true, '#0f172a', '#334155');

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Disposición 1-3-3-1', tx + tw / 2, ty + 18);

  const levels = [
    { label: 'R4 (Anular)', contacts: [meta[7]], isDir: false },
    { label: 'R3 (Direccional)', contacts: [meta[4], meta[5], meta[6]], isDir: true },
    { label: 'R2 (Direccional)', contacts: [meta[1], meta[2], meta[3]], isDir: true },
    { label: 'R1 (Anular)', contacts: [meta[0]], isDir: false },
  ];

  let currY = ty + 30;
  levels.forEach((lvl) => {
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(lvl.label, tx + 10, currY + 10);

    if (lvl.isDir) {
      // 3 buttons across
      const btnW = (tw - 28) / 3;
      lvl.contacts.forEach((c, i) => {
        const bx = tx + 10 + i * (btnW + 4);
        const pol = p.c[c.index];
        const segLetter = i === 0 ? 'A' : i === 1 ? 'B' : 'C';
        drawContactChip(ctx, bx, currY + 14, btnW, 30, `C${c.globalNumber} (${segLetter})`, pol);
      });
      currY += 52;
    } else {
      // 1 full-width ring button
      const c = lvl.contacts[0];
      const pol = p.c[c.index];
      drawContactChip(ctx, tx + 10, currY + 14, tw - 20, 28, `C${c.globalNumber} · Ring 360°`, pol);
      currY += 50;
    }
  });
}

function drawContactChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  pol: '0' | 'n' | 'p' | 0
) {
  let fill = '#1e293b';
  let stroke = '#475569';
  let sym = '·';
  let textCol = '#cbd5e1';

  if (pol === 'n') {
    fill = COLOR_CATHODE;
    stroke = '#2dd4bf';
    sym = '−';
    textCol = '#ffffff';
  } else if (pol === 'p') {
    fill = COLOR_ANODE;
    stroke = '#fbbf24';
    sym = '+';
    textCol = '#ffffff';
  }

  roundRect(ctx, x, y, w, h, 5, true, true, fill, stroke);
  ctx.fillStyle = textCol;
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 - 2);

  ctx.font = 'bold 13px Arial';
  ctx.fillText(sym, x + w / 2, y + h / 2 + 10);
}

function drawFallbackLeadDiagram(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  p: ProgramSettings,
  meta: typeof CONTACT_METADATA_LEFT,
  rotationDeg: number
) {
  roundRect(ctx, x, y, w, h, 8, true, true, '#090d16', '#334155');
  ctx.fillStyle = '#64748b';
  ctx.font = '10px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Lead 1-3-3-1 (Rotación: ${rotationDeg}°)`, x + w / 2, y + 16);

  // Draw 2D schematic lead cylinder
  const cx = x + w / 2;
  const leadW = 34;
  const leadH = 190;
  const leadY = y + 36;

  // Shaft
  roundRect(ctx, cx - leadW / 2, leadY, leadW, leadH, 16, true, false, '#334155');

  // Contact bands from bottom (R1) to top (R4)
  const contactHeights = [
    leadY + leadH - 28, // R1
    leadY + leadH - 74, // R2
    leadY + leadH - 120, // R3
    leadY + leadH - 166, // R4
  ];

  // R1 Ring
  const pol1 = p.c[0];
  ctx.fillStyle = pol1 === 'n' ? COLOR_CATHODE : pol1 === 'p' ? COLOR_ANODE : COLOR_METAL;
  ctx.fillRect(cx - leadW / 2, contactHeights[0], leadW, 20);

  // R2 Directional
  const segW = leadW / 3;
  [1, 2, 3].forEach((idx, s) => {
    const pol = p.c[idx];
    ctx.fillStyle = pol === 'n' ? COLOR_CATHODE : pol === 'p' ? COLOR_ANODE : COLOR_METAL;
    ctx.fillRect(cx - leadW / 2 + s * segW + 1, contactHeights[1], segW - 2, 20);
  });

  // R3 Directional
  [4, 5, 6].forEach((idx, s) => {
    const pol = p.c[idx];
    ctx.fillStyle = pol === 'n' ? COLOR_CATHODE : pol === 'p' ? COLOR_ANODE : COLOR_METAL;
    ctx.fillRect(cx - leadW / 2 + s * segW + 1, contactHeights[2], segW - 2, 20);
  });

  // R4 Ring
  const pol4 = p.c[7];
  ctx.fillStyle = pol4 === 'n' ? COLOR_CATHODE : pol4 === 'p' ? COLOR_ANODE : COLOR_METAL;
  ctx.fillRect(cx - leadW / 2, contactHeights[3], leadW, 20);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | number[],
  fill: boolean,
  stroke: boolean,
  fillColor?: string,
  strokeColor?: string
) {
  if (fillColor) ctx.fillStyle = fillColor;
  if (strokeColor) ctx.strokeStyle = strokeColor;
  ctx.beginPath();
  if (Array.isArray(radius)) {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.roundRect(x, y, w, h, radius);
  }
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
