/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useId } from 'react';
import { DBSState, HemisphereState, Polarity, ProgramSettings } from './types/dbs';
import { HemispherePanel } from './components/HemispherePanel';
import { generateCardPNG } from './utils/exportCard';
import { computeTheoreticalVTA } from './utils/vtaModel';
import {
  Download,
  Copy,
  Check,
  FileText,
  Code,
  Activity,
  Layers,
  Sparkles,
  Calendar,
  User,
  RefreshCw,
  Share2,
  AlertTriangle,
  FileSpreadsheet,
  Smartphone,
  ExternalLink,
  X,
} from 'lucide-react';

const createDefaultProgram = (defaultAmp = '3.00'): ProgramSettings => ({
  c: Array(8).fill(0),
  cs: 'p', // default Monopolar with case (+)
  amp: defaultAmp,
  pw: '60',
  hz: '130',
});

const initialDBSState: DBSState = {
  patientId: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
  L: {
    t: 'STN',
    inter: false,
    p: [
      {
        c: ['n', 0, 0, 0, 0, 0, 0, 0], // Contact 1 (R1 distal) active cathode
        cs: 'p',
        amp: '2.80',
        pw: '60',
        hz: '130',
      },
      createDefaultProgram('2.20'),
    ],
    leadRotationDeg: 0,
  },
  R: {
    t: 'STN',
    inter: false,
    p: [
      {
        c: [0, 'n', 0, 0, 0, 0, 0, 0], // Contact 10 (R2-A directional) active cathode
        cs: 'p',
        amp: '2.50',
        pw: '60',
        hz: '130',
      },
      createDefaultProgram('2.00'),
    ],
    leadRotationDeg: 15, // standard slight surgical offset
  },
};

export default function App() {
  const [state, setState] = useState<DBSState>(initialDBSState);
  const [activeTab, setActiveTab] = useState<'both' | 'L' | 'R'>('both');
  const [copiedKey, setCopiedKey] = useState<'csv' | 'json' | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showDataDrawer, setShowDataDrawer] = useState<'csv' | 'json' | null>(null);
  const [showMobileGuide, setShowMobileGuide] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Update Hemisphere states
  const handleHemisphereChange = (hemi: 'L' | 'R', newHemiState: HemisphereState) => {
    setState((prev) => ({
      ...prev,
      [hemi]: newHemiState,
    }));
  };

  // Generate CSV data matching user's original data structure with extra VTA metrics
  const generateCSV = () => {
    const rows: Record<string, string | number>[] = [];

    const addProgRow = (hemiKey: 'L' | 'R', progIdx: number) => {
      const h = state[hemiKey];
      const p = h.p[progIdx];
      const off = hemiKey === 'L' ? 0 : 8;
      const negs = p.c
        .map((val, idx) => (val === 'n' ? idx + 1 + off : null))
        .filter(Boolean);
      const poss = p.c
        .map((val, idx) => (val === 'p' ? idx + 1 + off : null))
        .filter(Boolean);

      const vta = computeTheoreticalVTA(p, h.leadRotationDeg);

      rows.push({
        paciente: state.patientId || 'Anonimo',
        fecha: state.date,
        hemisferio: hemiKey === 'L' ? 'Izquierdo' : 'Derecho',
        target: h.t,
        programa: `P${progIdx + 1}`,
        contactos_negativos: negs.join('|'),
        contactos_positivos: poss.join('|'),
        carcasa: p.cs === 'p' ? '+' : p.cs === 'n' ? '-' : '0',
        amplitud_mA: p.amp,
        ancho_pulso_us: p.pw,
        frecuencia_Hz: p.hz,
        interleaving: h.inter ? 'si' : 'no',
        vta_volumen_mm3: vta.volumeMm3,
        vta_radio_mm: vta.effectiveRadiusMm,
        rotacion_lead_deg: h.leadRotationDeg,
      });
    };

    (['L', 'R'] as const).forEach((hemiKey) => {
      addProgRow(hemiKey, 0);
      if (state[hemiKey].inter && state[hemiKey].p[1]) {
        addProgRow(hemiKey, 1);
      }
    });

    if (rows.length === 0) return '';
    const keys = Object.keys(rows[0]);
    const header = keys.join(',');
    const body = rows.map((r) => keys.map((k) => `"${String(r[k]).replace(/"/g, '""')}"`).join(','));
    return [header, ...body].join('\n');
  };

  // Generate JSON data
  const generateJSON = () => {
    return JSON.stringify(state, null, 2);
  };

  // Copy to clipboard helper
  const handleCopy = (type: 'csv' | 'json') => {
    const text = type === 'csv' ? generateCSV() : generateJSON();
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Download high-resolution PNG card or share directly on mobile
  const handleDownloadPNG = async () => {
    try {
      setIsExporting(true);
      const leftCanvas = document.querySelector<HTMLCanvasElement>('canvas[data-dbs-hemi="L"]');
      const rightCanvas = document.querySelector<HTMLCanvasElement>('canvas[data-dbs-hemi="R"]');
      const leftSnapshotUrl = leftCanvas ? leftCanvas.toDataURL('image/png') : undefined;
      const rightSnapshotUrl = rightCanvas ? rightCanvas.toDataURL('image/png') : undefined;

      const dataUrl = await generateCardPNG({
        state,
        leftSnapshotUrl,
        rightSnapshotUrl,
      });

      const cleanPid = (state.patientId || 'paciente').replace(/\W+/g, '_');
      const fileName = `DBS_1331_${cleanPid}_${state.date}.png`;

      // Try native mobile share if available (WhatsApp, AirDrop, Save to Photos, etc.)
      let sharedSuccessfully = false;
      if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Programación DBS - ${state.patientId || 'Paciente'}`,
              text: `Ficha de programación DBS (${state.date})`,
            });
            sharedSuccessfully = true;
          }
        } catch {
          // If user cancels share sheet or error occurs, fall back to download
        }
      }

      if (!sharedSuccessfully) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Error al generar imagen PNG:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Reset to default
  const handleReset = () => {
    if (confirm('¿Desea restablecer todos los parámetros de estimulación a los valores iniciales?')) {
      setState(initialDBSState);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Generador de Programas DBS 3D
                </h1>
                <span className="bg-teal-950 text-teal-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-teal-500/30">
                  1-3-3-1 & VTA FastField
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Visualización 3D de electrodos direccionales, estimación de campo volumétrico y exportación de ficha clínica
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPNG}
              disabled={isExporting}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-lg shadow-teal-500/25 transition-all duration-150 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generando...' : 'Descargar Tarjeta PNG'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopy('csv')}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 transition-colors"
              title="Copiar datos tabulares en formato CSV"
            >
              {copiedKey === 'csv' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'csv' ? '¡Copiado!' : 'Copiar CSV'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopy('json')}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 transition-colors"
              title="Copiar configuración en formato JSON"
            >
              {copiedKey === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'json' ? '¡Copiado!' : 'Copiar JSON'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMobileGuide(true)}
              className="flex items-center gap-1.5 bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 text-xs px-3 py-2 rounded-xl border border-cyan-700/60 transition-colors shadow-sm"
              title="Ver cómo abrir y guardar en tu celular o publicar gratis"
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>Abrir en Celular</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
              title="Restablecer parámetros iniciales"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex flex-col gap-5 flex-1">
        {/* Patient & Session Info Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            {/* Patient ID */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex-1 min-w-[200px]">
              <User className="w-4 h-4 text-cyan-400" />
              <label className="text-xs text-slate-400 shrink-0">Paciente / ID:</label>
              <input
                type="text"
                value={state.patientId}
                onChange={(e) => setState({ ...state, patientId: e.target.value })}
                placeholder="p. ej. PAC-0428 (Opcional)"
                className="bg-transparent text-white font-semibold text-xs focus:outline-none w-full"
              />
            </div>

            {/* Date */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <label className="text-xs text-slate-400 shrink-0">Fecha:</label>
              <input
                type="date"
                value={state.date}
                onChange={(e) => setState({ ...state, date: e.target.value })}
                className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
              />
            </div>

            {/* Notes */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex-1 min-w-[200px]">
              <FileText className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={state.notes}
                onChange={(e) => setState({ ...state, notes: e.target.value })}
                placeholder="Notas clínicas / respuesta motora..."
                className="bg-transparent text-white text-xs focus:outline-none w-full"
              />
            </div>
          </div>

          {/* View Tab Selector: Both / Left / Right */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('both')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'both' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ambos Hemisferios
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('L')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'L' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Izquierdo (1–8)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('R')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'R' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Derecho (9–16)
            </button>
          </div>
        </div>

        {/* Informative Guidance Banner */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>
              <strong>Guía de interacción:</strong> Haga clic sobre los contactos en el esquema 2D o en el visor 3D para alternar entre{' '}
              <span className="text-slate-400">Apagado</span> →{' '}
              <span className="text-teal-400 font-semibold">Cátodo (−)</span> →{' '}
              <span className="text-amber-400 font-semibold">Ánodo (+)</span>.
            </span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-slate-400 text-[11px]">
            <span>Nivel 1 & 4: Anulares (360°)</span>
            <span>·</span>
            <span>Nivel 2 & 3: Direccionales (3 × 120°)</span>
          </div>
        </div>

        {/* Hemisphere Panels Layout */}
        <div className={`grid gap-6 ${activeTab === 'both' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
          {(activeTab === 'both' || activeTab === 'L') && (
            <HemispherePanel
              hemisphere="L"
              state={state.L}
              onChange={(newL) => handleHemisphereChange('L', newL)}
            />
          )}

          {(activeTab === 'both' || activeTab === 'R') && (
            <HemispherePanel
              hemisphere="R"
              state={state.R}
              onChange={(newR) => handleHemisphereChange('R', newR)}
            />
          )}
        </div>

        {/* CSV & JSON Collapsible Viewer / Drawer */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Datos Estructurados para Registro / Base de Datos</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDataDrawer(showDataDrawer === 'csv' ? null : 'csv')}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                  showDataDrawer === 'csv'
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                Ver CSV
              </button>
              <button
                type="button"
                onClick={() => setShowDataDrawer(showDataDrawer === 'json' ? null : 'json')}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                  showDataDrawer === 'json'
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                Ver JSON
              </button>
            </div>
          </div>

          {showDataDrawer === 'csv' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Formato tabular CSV (compatible con Excel / HCE)</span>
                <button
                  type="button"
                  onClick={() => handleCopy('csv')}
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copiar al portapapeles
                </button>
              </div>
              <textarea
                readOnly
                value={generateCSV()}
                className="w-full h-32 bg-slate-950 font-mono text-xs text-slate-300 p-3 rounded-xl border border-slate-800 focus:outline-none select-all"
              />
            </div>
          )}

          {showDataDrawer === 'json' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Estructura de datos JSON exportable</span>
                <button
                  type="button"
                  onClick={() => handleCopy('json')}
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copiar al portapapeles
                </button>
              </div>
              <textarea
                readOnly
                value={generateJSON()}
                className="w-full h-40 bg-slate-950 font-mono text-xs text-slate-300 p-3 rounded-xl border border-slate-800 focus:outline-none select-all"
              />
            </div>
          )}
        </div>
      </main>

      {/* Clinical Disclaimer Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 px-4 py-3 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500/80 shrink-0" />
          <span>
            <strong>Aviso Clínico:</strong> El modelo de VTA FastField implementado genera una representación teórica del campo eléctrico para asistencia en programación y documentación. No debe utilizarse para navegación estereotáxica quirúrgica directa ni como sustituto del juicio clínico especializado.
          </span>
        </div>
      </footer>
      {/* Mobile & Free Publishing Guide Modal */}
      {showMobileGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Abrir en Celular y Publicar Gratis</h3>
                  <p className="text-xs text-slate-400">Acceso móvil instantáneo y opciones de hosting</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct Link Section */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-xs font-semibold text-cyan-400">1. Tu enlace activo en este momento:</span>
              <p className="text-[11px] text-slate-400">
                Puedes abrir este enlace ahora mismo en el navegador de tu celular (Safari o Chrome):
              </p>
              <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700 text-xs font-mono text-slate-300 break-all select-all">
                <span className="truncate flex-1">{typeof window !== 'undefined' ? window.location.href : ''}</span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0 flex items-center gap-1"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* PWA / Add to Home Screen Instructions */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2 text-xs">
              <span className="font-semibold text-teal-400">2. Cómo guardarlo como App en la pantalla de inicio:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1 text-[11px]">
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                  <div className="font-bold text-white mb-1">📱 En iPhone (Safari):</div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-300">
                    <li>Abre el enlace en Safari.</li>
                    <li>Toca el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba).</li>
                    <li>Selecciona <strong>«Agregar a pantalla de inicio»</strong>.</li>
                  </ol>
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                  <div className="font-bold text-white mb-1">🤖 En Android (Chrome):</div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-300">
                    <li>Abre el enlace en Chrome.</li>
                    <li>Toca los <strong>tres puntos (⋮)</strong> arriba a la derecha.</li>
                    <li>Pulsa <strong>«Instalar aplicación»</strong> o <strong>«Añadir a pantalla principal»</strong>.</li>
                  </ol>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                ✨ Se abrirá como una aplicación nativa a pantalla completa y podrás generar y compartir tus tarjetas PNG por WhatsApp o guardarlas en tu galería en un solo toque.
              </p>
            </div>

            {/* Free Hosting Alternatives */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2 text-xs">
              <span className="font-semibold text-purple-400">3. Si quieres publicarlo con tu propio dominio o cuenta gratuita:</span>
              <div className="space-y-1.5 text-[11px] text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-white shrink-0">• Vercel (vercel.com):</span>
                  <span>100% gratis para proyectos personales. Conectas tu repositorio de GitHub y te da una URL HTTPS instantánea (ej. <code className="text-cyan-400">midbs.vercel.app</code>).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-white shrink-0">• Netlify (netlify.com):</span>
                  <span>Gratis y sin configuración. Puedes arrastrar la carpeta compilada (<code className="text-cyan-400">dist/</code>) directamente en su web.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-white shrink-0">• GitHub Pages:</span>
                  <span>Completamente gratuito si tienes cuenta en GitHub.</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMobileGuide(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-colors"
            >
              Entendido / Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
