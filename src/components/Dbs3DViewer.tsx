/**
 * Interactive 3D DBS Lead & FastField VTA Visualizer
 *
 * Implements:
 * - Full 1-3-3-1 Directional Lead Model (Boston Scientific / Abbott style)
 * - PBR Platinum-Iridium metallic contacts and polyurethane shaft
 * - FastField Theoretical VTA translucent 3D mesh with directional steering
 * - Raycasting contact click to toggle polarity in 3D
 * - Anatomical orientation compass (A/P/M/L) and surgical rotation
 * - Preset view transitions (3D, Axial, Coronal, Sagittal)
 * - High-res snapshot export support
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ContactInfo, Polarity, ProgramSettings } from '../types/dbs';
import {
  CONTACT_HEIGHT_MM,
  CONTACT_METADATA_LEFT,
  CONTACT_METADATA_RIGHT,
  LEAD_RADIUS_MM,
  LEVEL_Y_POSITIONS,
  COLOR_CATHODE,
  COLOR_ANODE,
  COLOR_METAL,
} from '../utils/dbsConstants';
import { computeTheoreticalVTA, VTAModelResult } from '../utils/vtaModel';
import { RotateCw, Compass, Eye, Layers, Maximize2, Sparkles, HelpCircle } from 'lucide-react';

interface Dbs3DViewerProps {
  hemisphere: 'L' | 'R';
  programIndex: number;
  program: ProgramSettings;
  leadRotationDeg: number;
  onLeadRotationChange?: (deg: number) => void;
  onContactClick?: (contactIndex: number) => void;
  targetName?: string;
  className?: string;
  readOnly?: boolean;
  onSnapshotReady?: (dataUrl: string) => void;
}

export const Dbs3DViewer: React.FC<Dbs3DViewerProps> = ({
  hemisphere,
  programIndex,
  program,
  leadRotationDeg,
  onLeadRotationChange,
  onContactClick,
  targetName = 'STN',
  className = '',
  readOnly = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const leadGroupRef = useRef<THREE.Group | null>(null);
  const vtaGroupRef = useRef<THREE.Group | null>(null);
  const contactMeshesRef = useRef<THREE.Mesh[]>([]);
  const compassGroupRef = useRef<THREE.Group | null>(null);

  const [vtaVisible, setVtaVisible] = useState(true);
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [hoveredContact, setHoveredContact] = useState<number | null>(null);
  const [currentView, setCurrentView] = useState<'iso' | 'axial' | 'coronal' | 'sagittal'>('iso');
  const [vtaMetrics, setVtaMetrics] = useState<VTAModelResult | null>(null);

  const contactsMeta = hemisphere === 'L' ? CONTACT_METADATA_LEFT : CONTACT_METADATA_RIGHT;

  // Initialize Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 450;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a'); // Clinical dark slate navy
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(10, 5, 14);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // Needed for card PNG snapshot export!
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute('data-dbs-hemi', hemisphere);
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Studio Environment reflection
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {
      // Fallback if RoomEnvironment fails
    }

    // Studio Lighting
    const keyLight = new THREE.DirectionalLight(0xfff8ee, 2.5);
    keyLight.position.set(8, 12, 10);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xcceeff, 1.4);
    fillLight.position.set(-10, -5, -8);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.8);
    rimLight.position.set(0, 10, -12);
    scene.add(rimLight);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 0.7);
    scene.add(hemiLight);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.minDistance = 4;
    controls.maxDistance = 35;
    controls.maxPolarAngle = Math.PI - 0.05;
    controlsRef.current = controls;

    // Build 3D DBS Lead Group
    const leadGroup = new THREE.Group();
    scene.add(leadGroup);
    leadGroupRef.current = leadGroup;

    // Build 3D VTA Group
    const vtaGroup = new THREE.Group();
    scene.add(vtaGroup);
    vtaGroupRef.current = vtaGroup;

    // Build Anatomical Compass
    const compassGroup = buildCompass(hemisphere);
    scene.add(compassGroup);
    compassGroupRef.current = compassGroup;

    // Contact meshes storage
    contactMeshesRef.current = [];

    // Polyurethane Lead Shaft
    const shaftRadius = LEAD_RADIUS_MM;
    const shaftLength = 18; // mm
    const shaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 48);
    const shaftMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      metalness: 0.05,
      roughness: 0.2,
      transmission: isSoftwareGl ? 0 : 0.45,
      transparent: true,
      opacity: 0.82,
      thickness: 0.5,
      depthWrite: true,
    });
    const shaftMesh = new THREE.Mesh(shaftGeom, shaftMat);
    shaftMesh.position.y = 2.5; // Centers electrode array near y=0
    leadGroup.add(shaftMesh);

    // Distal rounded tip (hemisphere)
    const tipGeom = new THREE.SphereGeometry(shaftRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const tipMesh = new THREE.Mesh(tipGeom, shaftMat);
    tipMesh.rotation.x = Math.PI;
    tipMesh.position.y = LEVEL_Y_POSITIONS[1] - CONTACT_HEIGHT_MM / 2 - 0.4;
    leadGroup.add(tipMesh);

    // Alignment / Radiopaque orientation marker band near proximal end
    const markerGeom = new THREE.BoxGeometry(shaftRadius * 0.5, 1.2, 0.15);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.8,
      roughness: 0.3,
    });
    const markerMesh = new THREE.Mesh(markerGeom, markerMat);
    markerMesh.position.set(0, LEVEL_Y_POSITIONS[4] + CONTACT_HEIGHT_MM / 2 + 1.2, shaftRadius + 0.02);
    leadGroup.add(markerMesh);

    // Build the 8 contacts (1-3-3-1 arrangement)
    buildLeadContacts(leadGroup, contactMeshesRef.current);

    // Subtle Ground contact shadow disc
    const shadowGeom = new THREE.CircleGeometry(4, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x050814,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -6;
    scene.add(shadowMesh);

    // Subtle coordinate grid plane at bottom
    const gridHelper = new THREE.GridHelper(10, 10, 0x334155, 0x1e293b);
    gridHelper.position.y = -6;
    scene.add(gridHelper);

    // Animation / Render loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      // Gentle glow pulse for active contacts/VTA
      if (vtaGroupRef.current) {
        const time = performance.now() * 0.0015;
        vtaGroupRef.current.children.forEach((child) => {
          if ((child as THREE.Mesh).material && ((child as THREE.Mesh).material as THREE.MeshPhysicalMaterial).opacity !== undefined) {
            const mat = (child as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
            if (mat.name === 'vta-main') {
              mat.opacity = 0.52 + Math.sin(time) * 0.04;
            }
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [hemisphere]);

  // Update lead rotation in 3D
  useEffect(() => {
    if (leadGroupRef.current) {
      leadGroupRef.current.rotation.y = (leadRotationDeg * Math.PI) / 180;
    }
  }, [leadRotationDeg]);

  // Update contact colors based on program polarity
  useEffect(() => {
    const meshes = contactMeshesRef.current;
    if (!meshes || meshes.length === 0) return;

    program.c.forEach((pol, idx) => {
      const mesh = meshes[idx];
      if (!mesh) return;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat) return;

      if (pol === 'n') {
        // Cathode (-) : Electric Teal Glow
        mat.color.set(COLOR_CATHODE);
        mat.emissive.set(COLOR_CATHODE);
        mat.emissiveIntensity = 0.65;
        mat.roughness = 0.2;
        mat.metalness = 0.85;
      } else if (pol === 'p') {
        // Anode (+) : Warm Amber Glow
        mat.color.set(COLOR_ANODE);
        mat.emissive.set(COLOR_ANODE);
        mat.emissiveIntensity = 0.65;
        mat.roughness = 0.2;
        mat.metalness = 0.85;
      } else {
        // Off : Lustrous Platinum metal
        mat.color.set(COLOR_METAL);
        mat.emissive.set(0x000000);
        mat.emissiveIntensity = 0;
        mat.roughness = 0.35;
        mat.metalness = 0.95;
      }
    });
  }, [program.c]);

  // Update Theoretical VTA 3D Mesh
  useEffect(() => {
    const vtaGroup = vtaGroupRef.current;
    if (!vtaGroup) return;

    // Clear previous VTA children
    while (vtaGroup.children.length > 0) {
      const child = vtaGroup.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
      vtaGroup.remove(child);
    }

    // Compute FastField VTA metrics
    const metrics = computeTheoreticalVTA(program, leadRotationDeg);
    setVtaMetrics(metrics);

    if (!vtaVisible || metrics.volumeMm3 <= 0 || metrics.components.length === 0) {
      return;
    }

    // Color based on active configuration
    // Teal cyan for cathodic stimulation; amber if anodic only
    const vtaColor = metrics.activeCathodeIndices.length > 0 ? 0x14b8a6 : 0xf59e0b;
    const vtaGlowColor = metrics.activeCathodeIndices.length > 0 ? 0x38bdf8 : 0xfbbf24;

    // Generate merged or compound VTA components
    metrics.components.forEach((comp, compIdx) => {
      const [rx, ry, rz] = comp.radii;
      const [cx, cy, cz] = comp.center;

      // Base smooth ellipsoid geometry
      const vtaGeom = new THREE.SphereGeometry(1, 48, 32);
      vtaGeom.scale(rx, ry, rz);

      // Translucent volumetric material
      const vtaMat = new THREE.MeshPhysicalMaterial({
        color: vtaColor,
        emissive: vtaGlowColor,
        emissiveIntensity: 0.3,
        roughness: 0.15,
        metalness: 0.1,
        transmission: 0.3,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        name: 'vta-main',
        side: THREE.DoubleSide,
      });

      const vtaMesh = new THREE.Mesh(vtaGeom, vtaMat);
      vtaMesh.position.set(cx, cy, cz);
      vtaMesh.rotation.y = comp.rotationYRad;
      vtaGroup.add(vtaMesh);

      // Subtle contour wireframe / ring for depth definition
      const wireGeom = new THREE.SphereGeometry(1, 16, 12);
      wireGeom.scale(rx * 1.002, ry * 1.002, rz * 1.002);
      const wireMat = new THREE.MeshBasicMaterial({
        color: vtaGlowColor,
        wireframe: true,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      });
      const wireMesh = new THREE.Mesh(wireGeom, wireMat);
      wireMesh.position.set(cx, cy, cz);
      wireMesh.rotation.y = comp.rotationYRad;
      vtaGroup.add(wireMesh);
    });

    // Add directional steering vector arrow in X-Z plane if significant directional bias
    if (metrics.directionalBias.magnitudeMm > 0.3) {
      const arrowLength = metrics.directionalBias.magnitudeMm * 1.8;
      const dir = new THREE.Vector3(
        metrics.directionalBias.x,
        0,
        metrics.directionalBias.z
      ).normalize();

      const arrowHelper = new THREE.ArrowHelper(
        dir,
        new THREE.Vector3(0, metrics.centerMm[1], 0),
        arrowLength,
        0x38bdf8,
        0.5,
        0.35
      );
      vtaGroup.add(arrowHelper);
    }
  }, [program, leadRotationDeg, vtaVisible]);

  // Raycasting for direct contact clicking in 3D
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (readOnly || !onContactClick || !mountRef.current || !cameraRef.current || !rendererRef.current) return;

      const rect = mountRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const intersects = raycaster.intersectObjects(contactMeshesRef.current, false);
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const contactIdx = hitMesh.userData.contactIndex;
        if (typeof contactIdx === 'number') {
          onContactClick(contactIdx);
        }
      }
    },
    [onContactClick, readOnly]
  );

  // Hover detection for 3D contacts
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!mountRef.current || !cameraRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const intersects = raycaster.intersectObjects(contactMeshesRef.current, false);
      if (intersects.length > 0) {
        const contactIdx = (intersects[0].object as THREE.Mesh).userData.contactIndex;
        setHoveredContact(contactIdx);
        if (mountRef.current) mountRef.current.style.cursor = 'pointer';
      } else {
        setHoveredContact(null);
        if (mountRef.current) mountRef.current.style.cursor = 'default';
      }
    },
    []
  );

  // Camera presets
  const setCameraView = (view: 'iso' | 'axial' | 'coronal' | 'sagittal') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    setCurrentView(view);

    controls.target.set(0, 0, 0);

    if (view === 'iso') {
      camera.position.set(10, 5, 14);
    } else if (view === 'axial') {
      // Top-down view looking along lead shaft
      camera.position.set(0, 16, 0.01);
    } else if (view === 'coronal') {
      // Anterior-Posterior front view
      camera.position.set(0, 0, 18);
    } else if (view === 'sagittal') {
      // Lateral-Medial side view
      camera.position.set(18, 0, 0);
    }
    controls.update();
  };

  return (
    <div className={`relative flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden select-none ${className}`}>
      {/* Top Overlay Bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-3 py-2 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800/60 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white tracking-wide flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${hemisphere === 'L' ? 'bg-cyan-400' : 'bg-emerald-400'}`} />
            Hemisferio {hemisphere === 'L' ? 'Izquierdo' : 'Derecho'} ({targetName})
          </span>
          <span className="text-slate-400 font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded">
            P{programIndex + 1}
          </span>
        </div>

        {/* VTA Badge & Metrics */}
        {vtaMetrics && vtaMetrics.volumeMm3 > 0 ? (
          <div className="flex items-center gap-2 bg-teal-950/70 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-md font-mono text-[11px]">
            <Sparkles className="w-3 h-3 text-teal-400 animate-pulse" />
            <span>VTA: {vtaMetrics.volumeMm3} mm³</span>
            {vtaMetrics.directionalBias.magnitudeMm > 0.3 && (
              <span className="text-[10px] text-teal-400 font-sans border-l border-teal-500/30 pl-1.5">
                Steering {vtaMetrics.directionalBias.angleDeg.toFixed(0)}°
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-500 text-[11px]">VTA inactivo</span>
        )}
      </div>

      {/* 3D WebGL Canvas */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        className="w-full h-80 sm:h-96 cursor-grab active:cursor-grabbing"
      />

      {/* Floating 3D Hover Tooltip */}
      {hoveredContact !== null && (
        <div className="absolute top-11 left-3 z-20 bg-slate-900/90 text-white text-xs px-2.5 py-1.5 rounded shadow-lg border border-slate-700 pointer-events-none">
          <div className="font-semibold text-cyan-400">{contactsMeta[hoveredContact].label}</div>
          <div className="text-[11px] text-slate-300">
            Nivel: {contactsMeta[hoveredContact].isRing ? 'Anular (360°)' : `Direccional (${contactsMeta[hoveredContact].angleDeg}°)`}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Polaridad actual: {program.c[hoveredContact] === 'n' ? 'Cátodo (−)' : program.c[hoveredContact] === 'p' ? 'Ánodo (+)' : 'Apagado'} (Clic para cambiar)
          </div>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className="relative z-10 p-2.5 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Camera Views */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60">
          <button
            onClick={() => setCameraView('iso')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              currentView === 'iso' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
            title="Vista isométrica 3D"
          >
            3D
          </button>
          <button
            onClick={() => setCameraView('axial')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              currentView === 'axial' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
            title="Vista axial (sección transversal 120°)"
          >
            Axial
          </button>
          <button
            onClick={() => setCameraView('coronal')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              currentView === 'coronal' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
            title="Vista coronal (Frontal)"
          >
            Coronal
          </button>
          <button
            onClick={() => setCameraView('sagittal')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              currentView === 'sagittal' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
            title="Vista sagital (Lateral)"
          >
            Sagital
          </button>
        </div>

        {/* Lead Rotation Knob/Slider */}
        <div className="flex items-center gap-2 bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-700/50">
          <RotateCw className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] text-slate-300">Rotación:</span>
          <input
            type="range"
            min="0"
            max="359"
            step="5"
            value={leadRotationDeg}
            onChange={(e) => onLeadRotationChange && onLeadRotationChange(Number(e.target.value))}
            className="w-16 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            title="Ajuste de rotación anatómica del electrodo (ángulo de implantación)"
          />
          <span className="font-mono text-[11px] text-cyan-400 w-8 text-right">{leadRotationDeg}°</span>
        </div>

        {/* VTA Visibility Toggle */}
        <button
          onClick={() => setVtaVisible(!vtaVisible)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
            vtaVisible
              ? 'bg-teal-950/70 border-teal-500/50 text-teal-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
          }`}
          title="Alternar visualización de VTA teórico FastField"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>VTA {vtaVisible ? 'Visible' : 'Oculto'}</span>
        </button>
      </div>
    </div>
  );
};

/**
 * Builds the 1-3-3-1 lead contact meshes:
 * - Level 1 (distal): 360° Ring
 * - Level 2: 3 Directional 120° segments
 * - Level 3: 3 Directional 120° segments
 * - Level 4 (proximal): 360° Ring
 */
function buildLeadContacts(parentGroup: THREE.Group, contactMeshes: THREE.Mesh[]) {
  const radius = LEAD_RADIUS_MM + 0.01; // Slightly larger than shaft to avoid z-fighting
  const height = CONTACT_HEIGHT_MM;

  // Level 1: R1 distal ring (Contact index 0)
  const ring1Geom = new THREE.CylinderGeometry(radius, radius, height, 48);
  const ring1Mat = new THREE.MeshStandardMaterial({
    color: COLOR_METAL,
    metalness: 0.95,
    roughness: 0.35,
  });
  const ring1Mesh = new THREE.Mesh(ring1Geom, ring1Mat);
  ring1Mesh.position.y = LEVEL_Y_POSITIONS[1];
  ring1Mesh.userData = { contactIndex: 0, isRing: true };
  parentGroup.add(ring1Mesh);
  contactMeshes.push(ring1Mesh);

  // Level 2: R2 directional contacts (Indices 1, 2, 3)
  // 3 segments at 120° intervals (e.g. 0°, 120°, 240°)
  // Segment coverage ~100° with 20° gap
  const segArc = (100 * Math.PI) / 180;
  const segGap = (20 * Math.PI) / 180;

  [0, 1, 2].forEach((segIdx) => {
    const centerAngle = (segIdx * 120 * Math.PI) / 180;
    const startAngle = centerAngle - segArc / 2;

    const segGeom = new THREE.CylinderGeometry(radius, radius, height, 24, 1, false, startAngle, segArc);
    const segMat = new THREE.MeshStandardMaterial({
      color: COLOR_METAL,
      metalness: 0.95,
      roughness: 0.35,
    });
    const segMesh = new THREE.Mesh(segGeom, segMat);
    segMesh.position.y = LEVEL_Y_POSITIONS[2];
    segMesh.userData = { contactIndex: 1 + segIdx, isRing: false, segmentIndex: segIdx };
    parentGroup.add(segMesh);
    contactMeshes.push(segMesh);
  });

  // Level 3: R3 directional contacts (Indices 4, 5, 6)
  [0, 1, 2].forEach((segIdx) => {
    const centerAngle = (segIdx * 120 * Math.PI) / 180;
    const startAngle = centerAngle - segArc / 2;

    const segGeom = new THREE.CylinderGeometry(radius, radius, height, 24, 1, false, startAngle, segArc);
    const segMat = new THREE.MeshStandardMaterial({
      color: COLOR_METAL,
      metalness: 0.95,
      roughness: 0.35,
    });
    const segMesh = new THREE.Mesh(segGeom, segMat);
    segMesh.position.y = LEVEL_Y_POSITIONS[3];
    segMesh.userData = { contactIndex: 4 + segIdx, isRing: false, segmentIndex: segIdx };
    parentGroup.add(segMesh);
    contactMeshes.push(segMesh);
  });

  // Level 4: R4 proximal ring (Contact index 7)
  const ring4Geom = new THREE.CylinderGeometry(radius, radius, height, 48);
  const ring4Mat = new THREE.MeshStandardMaterial({
    color: COLOR_METAL,
    metalness: 0.95,
    roughness: 0.35,
  });
  const ring4Mesh = new THREE.Mesh(ring4Geom, ring4Mat);
  ring4Mesh.position.y = LEVEL_Y_POSITIONS[4];
  ring4Mesh.userData = { contactIndex: 7, isRing: true };
  parentGroup.add(ring4Mesh);
  contactMeshes.push(ring4Mesh);
}

/**
 * Builds anatomical orientation compass ring (Anterior, Posterior, Medial, Lateral)
 */
function buildCompass(hemisphere: 'L' | 'R'): THREE.Group {
  const group = new THREE.Group();
  group.position.y = -5.8;

  // Thin ring
  const ringGeom = new THREE.RingGeometry(2.8, 3.0, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x334155,
    side: THREE.DoubleSide,
  });
  const ringMesh = new THREE.Mesh(ringGeom, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  group.add(ringMesh);

  // Anatomical direction markers
  // Anterior (+Z in scene), Posterior (-Z)
  // For Left brain: Lateral is -X, Medial is +X (towards midline)
  // For Right brain: Medial is -X, Lateral is +X
  const medX = hemisphere === 'L' ? 3.3 : -3.3;
  const latX = hemisphere === 'L' ? -3.3 : 3.3;

  const markers = [
    { text: 'A', pos: [0, 0, 3.4], color: '#38bdf8' },  // Anterior
    { text: 'P', pos: [0, 0, -3.4], color: '#94a3b8' }, // Posterior
    { text: 'M', pos: [medX, 0, 0], color: '#a78bfa' }, // Medial
    { text: 'L', pos: [latX, 0, 0], color: '#94a3b8' }, // Lateral
  ];

  markers.forEach((m) => {
    const sprite = createTextSprite(m.text, m.color);
    sprite.position.set(m.pos[0], 0.2, m.pos[2]);
    sprite.scale.set(0.9, 0.9, 0.9);
    group.add(sprite);
  });

  return group;
}

/**
 * Creates 2D text sprite billboard for 3D coordinates
 */
function createTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  return new THREE.Sprite(mat);
}
