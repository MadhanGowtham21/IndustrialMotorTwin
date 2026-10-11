/**
 * Interactive 3D Industrial Motor Digital Twin Viewer
 * Built with Three.js procedural CAD geometry, PBR metallic materials, studio lighting,
 * dynamic shaft/fan rotation coupled to measured RPM, fault heatmaps, and raycast inspection.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  Maximize2,
  Eye,
  Layers,
  Thermometer,
  Activity,
  AlertTriangle,
  Play,
  Pause,
  Info,
} from 'lucide-react';
import { Esp32SensorData, AiDiagnosisResult } from '../types/telemetry';

interface Motor3DViewerProps {
  sensorData: Esp32SensorData | null;
  aiDiagnosis: AiDiagnosisResult | null;
  onSelectComponent: (componentId: string) => void;
  selectedComponentId: string | null;
}

export const Motor3DViewer: React.FC<Motor3DViewerProps> = React.memo(({
  sensorData,
  aiDiagnosis,
  onSelectComponent,
  selectedComponentId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // UI Control states
  const [isRotating, setIsRotating] = useState(true);
  const [showCallouts, setShowCallouts] = useState(true);
  const [isExploded, setIsExploded] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<'iso' | 'front' | 'side' | 'top'>('iso');
  const [webglError, setWebglError] = useState<string | null>(null);

  // Three.js instance references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rotatingShaftGroupRef = useRef<THREE.Group | null>(null);
  const motorRootGroupRef = useRef<THREE.Group | null>(null);
  const partsMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const materialMapRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

  // Mouse orbit controls references
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const sphericalRef = useRef({ radius: 8.5, theta: Math.PI / 4, phi: Math.PI / 3 });
  const targetLookAtRef = useRef(new THREE.Vector3(0, 0.4, 0));

  // Current shaft rotation speed interpolation
  const currentRotationSpeedRef = useRef(0);
  const sensorDataRef = useRef(sensorData);
  sensorDataRef.current = sensorData;
  const isRotatingRef = useRef(isRotating);
  isRotatingRef.current = isRotating;

  // Initialize Three.js Scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 480;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0e1420);
    scene.fog = new THREE.FogExp2(0x0e1420, 0.04);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. High-performance lightweight Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: false,
        powerPreference: 'default',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      rendererRef.current = renderer;
    } catch (err: unknown) {
      setWebglError('WebGL 2.0 context initialization failed on this device.');
      return;
    }

    // 4. Lighting - 3-Point Studio Setup
    const ambientLight = new THREE.AmbientLight(0x718096, 1.1);
    scene.add(ambientLight);

    // Key Light (Warm tinted directional)
    const keyLight = new THREE.DirectionalLight(0xe2e8f0, 2.0);
    keyLight.position.set(6, 9, 7);
    scene.add(keyLight);

    // Fill Light (Cool industrial cyan)
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    fillLight.position.set(-7, 4, -4);
    scene.add(fillLight);

    // Rim Light (Top back crisp highlight)
    const rimLight = new THREE.DirectionalLight(0x94a3b8, 1.4);
    rimLight.position.set(0, 8, -8);
    scene.add(rimLight);

    // 5. Floor & Technical Ground Grid
    const gridHelper = new THREE.GridHelper(18, 36, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -1.2;
    scene.add(gridHelper);

    // Subtle Ground Shadow Plane
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0e17,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.21;
    floor.receiveShadow = true;
    scene.add(floor);

    // 6. Build Procedural Motor Geometry
    const motorRoot = new THREE.Group();
    motorRootGroupRef.current = motorRoot;
    scene.add(motorRoot);

    buildProceduralMotor(motorRoot);

    // 7. Animation Loop with intelligent idle throttling
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let lastRenderTime = 0;

    const animate = (timestamp: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Interpolate shaft rotation speed based on current sensor state & RPM
      const currentSensor = sensorDataRef.current;
      const isMotorOn = currentSensor?.motorRunning ?? false;
      const currentRpm = currentSensor?.rpm ?? 0;
      const targetSpeed = isMotorOn && isRotatingRef.current ? (currentRpm / 60) * Math.PI * 0.4 : 0;
      currentRotationSpeedRef.current += (targetSpeed - currentRotationSpeedRef.current) * 0.1;

      const isShaftMoving = rotatingShaftGroupRef.current && currentRotationSpeedRef.current > 0.001;

      if (isShaftMoving) {
        rotatingShaftGroupRef.current!.rotation.x += currentRotationSpeedRef.current * delta * 5.0;
        renderer.render(scene, camera);
        lastRenderTime = timestamp;
      } else if (isDraggingRef.current || timestamp - lastRenderTime > 250) {
        // When stationary, throttle to a calm heartbeat render to preserve CPU
        renderer.render(scene, camera);
        lastRenderTime = timestamp;
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // WebGL Context recovery
    const canvas = canvasRef.current;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('WebGL context lost. Attempting auto-restore...');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      renderer.dispose();
    };
  }, []);

  // Update camera position from spherical coords
  const updateCameraPosition = () => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(targetLookAtRef.current);
  };

  // Set camera view preset
  const applyCameraPreset = (preset: 'iso' | 'front' | 'side' | 'top') => {
    setCameraPreset(preset);
    if (preset === 'iso') {
      sphericalRef.current = { radius: 8.5, theta: Math.PI / 4, phi: Math.PI / 3 };
    } else if (preset === 'front') {
      sphericalRef.current = { radius: 8.0, theta: 0, phi: Math.PI / 2.1 };
    } else if (preset === 'side') {
      sphericalRef.current = { radius: 8.0, theta: Math.PI / 2, phi: Math.PI / 2.1 };
    } else if (preset === 'top') {
      sphericalRef.current = { radius: 9.0, theta: 0.001, phi: 0.05 };
    }
    updateCameraPosition();
  };

  // Mouse / Touch orbit handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;

    sphericalRef.current.theta -= deltaX * 0.008;
    sphericalRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, sphericalRef.current.phi - deltaY * 0.008));

    updateCameraPosition();
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    sphericalRef.current.radius = Math.max(4.0, Math.min(16.0, sphericalRef.current.radius + e.deltaY * 0.005));
    updateCameraPosition();
  };

  // Raycaster click handler to select component
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
    for (const hit of intersects) {
      let curr: THREE.Object3D | null = hit.object;
      while (curr && curr !== sceneRef.current) {
        if (curr.userData?.componentId) {
          onSelectComponent(curr.userData.componentId);
          return;
        }
        curr = curr.parent;
      }
    }
  };

  // Exploded View Transition
  useEffect(() => {
    const parts = partsMapRef.current;
    const offset = isExploded ? 1.6 : 0;

    const fanCowl = parts.get('cooling_fan');
    if (fanCowl) fanCowl.position.x = isExploded ? -2.8 : -1.8;

    const frontBearing = parts.get('drive_bearing');
    if (frontBearing) frontBearing.position.x = isExploded ? 2.6 : 1.7;

    const terminalBox = parts.get('terminal_box');
    if (terminalBox) terminalBox.position.y = isExploded ? 2.2 : 1.45;

    const stator = parts.get('stator');
    if (stator) stator.position.set(0, 0, 0);

    const shaft = parts.get('rotor_shaft');
    if (shaft) shaft.position.y = isExploded ? -0.4 : 0;
  }, [isExploded]);

  // Update Materials / Heatmap Glow based on AI Fault Severity & Selected Component
  useEffect(() => {
    const materials = materialMapRef.current;
    const severity = aiDiagnosis?.severity ?? 'NOMINAL';
    const affected = aiDiagnosis?.affectedComponent ?? 'none';

    // Base colors
    const nominalStator = 0x1e293b;
    const nominalSteel = 0x94a3b8;

    const statorMat = materials.get('stator');
    const bearingMat = materials.get('drive_bearing');
    const shaftMat = materials.get('rotor_shaft');
    const fanMat = materials.get('cooling_fan');
    const termMat = materials.get('terminal_box');

    // Reset base colors
    if (statorMat) {
      statorMat.color.setHex(nominalStator);
      statorMat.emissive.setHex(0x000000);
    }
    if (bearingMat) {
      bearingMat.color.setHex(nominalSteel);
      bearingMat.emissive.setHex(0x000000);
    }
    if (shaftMat) {
      shaftMat.color.setHex(nominalSteel);
      shaftMat.emissive.setHex(0x000000);
    }
    if (fanMat) {
      fanMat.color.setHex(0x334155);
      fanMat.emissive.setHex(0x000000);
    }
    if (termMat) {
      termMat.color.setHex(0x1e293b);
      termMat.emissive.setHex(0x000000);
    }

    // Apply fault highlighting
    const highlightColor = severity === 'CRITICAL' ? 0xef4444 : severity === 'WARNING' ? 0xf59e0b : 0x10b981;
    const emissiveIntensity = severity === 'CRITICAL' ? 0x450a0a : severity === 'WARNING' ? 0x451a03 : 0x064e3b;

    if (affected === 'stator' && statorMat) {
      statorMat.emissive.setHex(emissiveIntensity);
    } else if (affected === 'drive_bearing' && bearingMat) {
      bearingMat.color.setHex(highlightColor);
      bearingMat.emissive.setHex(emissiveIntensity);
    } else if (affected === 'rotor_shaft' && shaftMat) {
      shaftMat.color.setHex(highlightColor);
      shaftMat.emissive.setHex(emissiveIntensity);
    } else if (affected === 'terminal_box' && termMat) {
      termMat.color.setHex(highlightColor);
      termMat.emissive.setHex(emissiveIntensity);
    } else if (affected === 'general') {
      // Highlight overall motor
      if (statorMat) statorMat.emissive.setHex(emissiveIntensity);
    }

    // Selected component highlight in cyan
    if (selectedComponentId) {
      const selMat = materials.get(selectedComponentId);
      if (selMat) {
        selMat.emissive.setHex(0x0891b2);
      }
    }
  }, [aiDiagnosis, selectedComponentId]);

  /**
   * Procedural CAD Industrial Motor Builder
   */
  const buildProceduralMotor = (rootGroup: THREE.Group) => {
    const parts = partsMapRef.current;
    const materials = materialMapRef.current;

    // Materials
    const castIronMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.75,
    });
    materials.set('stator', castIronMat);

    const polishedSteelMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.25,
      metalness: 0.9,
    });
    materials.set('rotor_shaft', polishedSteelMat);

    const bearingSteelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.3,
      metalness: 0.85,
    });
    materials.set('drive_bearing', bearingSteelMat);

    const fanCowlMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.7,
    });
    materials.set('cooling_fan', fanCowlMat);

    const terminalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.6,
    });
    materials.set('terminal_box', terminalMat);

    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.3,
      metalness: 0.85,
    });

    // --- 1. Stator Cylindrical Housing & Longitudinal Fins ---
    const statorGroup = new THREE.Group();
    statorGroup.userData = { componentId: 'stator' };
    parts.set('stator', statorGroup);

    // Stator Main Barrel (aligned along X axis: length 2.6, radius 1.1)
    const statorGeo = new THREE.CylinderGeometry(1.15, 1.15, 2.6, 32);
    const statorMesh = new THREE.Mesh(statorGeo, castIronMat);
    statorMesh.rotation.z = Math.PI / 2;
    statorMesh.castShadow = true;
    statorMesh.receiveShadow = true;
    statorGroup.add(statorMesh);

    // 16 Longitudinal Extruded Cooling Fins along periphery
    const finCount = 18;
    const finGeo = new THREE.BoxGeometry(2.5, 0.22, 0.04);
    for (let i = 0; i < finCount; i++) {
      const angle = (i / finCount) * Math.PI * 2;
      // Skip top region where terminal box sits (angles near Math.PI/2)
      if (angle > Math.PI * 0.35 && angle < Math.PI * 0.65) continue;
      // Skip bottom region where feet attach (angles near -Math.PI/2)
      if (angle > -Math.PI * 0.65 && angle < -Math.PI * 0.35) continue;

      const finMesh = new THREE.Mesh(finGeo, castIronMat);
      finMesh.position.y = Math.sin(angle) * 1.22;
      finMesh.position.z = Math.cos(angle) * 1.22;
      finMesh.rotation.x = -angle;
      finMesh.castShadow = true;
      statorGroup.add(finMesh);
    }

    // Heavy Industrial Mounting Feet (Base Pads)
    const footMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7, metalness: 0.8 });
    const footGeo = new THREE.BoxGeometry(0.5, 0.25, 2.9);
    // Front Foot
    const footFront = new THREE.Mesh(footGeo, footMat);
    footFront.position.set(0.9, -1.15, 0);
    footFront.castShadow = true;
    statorGroup.add(footFront);
    // Rear Foot
    const footRear = new THREE.Mesh(footGeo, footMat);
    footRear.position.set(-0.9, -1.15, 0);
    footRear.castShadow = true;
    statorGroup.add(footRear);

    rootGroup.add(statorGroup);

    // --- 2. Terminal Junction Box on Top ---
    const termGroup = new THREE.Group();
    termGroup.userData = { componentId: 'terminal_box' };
    termGroup.position.set(0, 1.45, 0);
    parts.set('terminal_box', termGroup);

    const termBoxGeo = new THREE.BoxGeometry(1.1, 0.55, 0.95);
    const termBoxMesh = new THREE.Mesh(termBoxGeo, terminalMat);
    termBoxMesh.castShadow = true;
    termGroup.add(termBoxMesh);

    // Terminal Box Lid Chamfer
    const lidGeo = new THREE.BoxGeometry(1.15, 0.08, 1.0);
    const lidMesh = new THREE.Mesh(lidGeo, terminalMat);
    lidMesh.position.y = 0.3;
    termGroup.add(lidMesh);

    // Cable Entry Gland on Side
    const glandGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 16);
    const glandMesh = new THREE.Mesh(glandGeo, bronzeMat);
    glandMesh.rotation.x = Math.PI / 2;
    glandMesh.position.set(0.2, 0.05, 0.55);
    termGroup.add(glandMesh);

    rootGroup.add(termGroup);

    // --- 3. Front Drive-End Bearing & End-Bell Cap ---
    const driveBearingGroup = new THREE.Group();
    driveBearingGroup.userData = { componentId: 'drive_bearing' };
    driveBearingGroup.position.set(1.4, 0, 0);
    parts.set('drive_bearing', driveBearingGroup);

    // End-Bell Flange
    const endBellGeo = new THREE.CylinderGeometry(1.18, 1.18, 0.25, 32);
    const endBellMesh = new THREE.Mesh(endBellGeo, bearingSteelMat);
    endBellMesh.rotation.z = Math.PI / 2;
    endBellMesh.castShadow = true;
    driveBearingGroup.add(endBellMesh);

    // Bearing Hub Housing
    const hubGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 24);
    const hubMesh = new THREE.Mesh(hubGeo, bearingSteelMat);
    hubMesh.rotation.z = Math.PI / 2;
    hubMesh.position.x = 0.25;
    hubMesh.castShadow = true;
    driveBearingGroup.add(hubMesh);

    // Hex Bolt pattern around end-bell
    const boltGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.08, 6);
    for (let b = 0; b < 6; b++) {
      const boltAngle = (b / 6) * Math.PI * 2;
      const boltMesh = new THREE.Mesh(boltGeo, polishedSteelMat);
      boltMesh.rotation.z = Math.PI / 2;
      boltMesh.position.set(0.14, Math.sin(boltAngle) * 0.9, Math.cos(boltAngle) * 0.9);
      driveBearingGroup.add(boltMesh);
    }

    rootGroup.add(driveBearingGroup);

    // --- 4. Rear Cooling Fan Cowl & Shroud ---
    const fanCowlGroup = new THREE.Group();
    fanCowlGroup.userData = { componentId: 'cooling_fan' };
    fanCowlGroup.position.set(-1.8, 0, 0);
    parts.set('cooling_fan', fanCowlGroup);

    // Shroud dome
    const cowlGeo = new THREE.CylinderGeometry(1.12, 1.15, 0.9, 32);
    const cowlMesh = new THREE.Mesh(cowlGeo, fanCowlMat);
    cowlMesh.rotation.z = Math.PI / 2;
    cowlMesh.castShadow = true;
    fanCowlGroup.add(cowlMesh);

    // Ventilation Intake Grille Ribs
    const grillRingGeo = new THREE.TorusGeometry(0.7, 0.035, 12, 32);
    const grillRingMesh = new THREE.Mesh(grillRingGeo, polishedSteelMat);
    grillRingMesh.rotation.y = Math.PI / 2;
    grillRingMesh.position.x = -0.46;
    fanCowlGroup.add(grillRingMesh);

    rootGroup.add(fanCowlGroup);

    // --- 5. Rotating Rotor Shaft Assembly (Spins with RPM!) ---
    const shaftRotatingGroup = new THREE.Group();
    shaftRotatingGroup.userData = { componentId: 'rotor_shaft' };
    rotatingShaftGroupRef.current = shaftRotatingGroup;
    parts.set('rotor_shaft', shaftRotatingGroup);

    // Shaft Geometry (Length 4.5 extends through front and rear)
    // Note: Shaft rotates around X axis in world, so we orient geometry along X
    const shaftGeo = new THREE.CylinderGeometry(0.24, 0.24, 4.4, 32);
    const shaftMesh = new THREE.Mesh(shaftGeo, polishedSteelMat);
    shaftMesh.rotation.z = Math.PI / 2;
    shaftMesh.position.x = 0.3;
    shaftMesh.castShadow = true;
    shaftRotatingGroup.add(shaftMesh);

    // Output Shaft Keyway Slot
    const keywayGeo = new THREE.BoxGeometry(0.5, 0.06, 0.06);
    const keywayMesh = new THREE.Mesh(keywayGeo, bronzeMat);
    keywayMesh.position.set(2.0, 0.23, 0);
    shaftRotatingGroup.add(keywayMesh);

    // Flexible Shaft Coupling Hub at output
    const couplingGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.55, 24);
    const couplingMesh = new THREE.Mesh(couplingGeo, castIronMat);
    couplingMesh.rotation.z = Math.PI / 2;
    couplingMesh.position.x = 2.15;
    couplingMesh.castShadow = true;
    shaftRotatingGroup.add(couplingMesh);

    // Internal Cooling Fan Impeller Blades (spins inside rear cowl)
    const fanImpellerGroup = new THREE.Group();
    fanImpellerGroup.position.x = -1.65;
    const bladeGeo = new THREE.BoxGeometry(0.12, 0.75, 0.03);
    for (let f = 0; f < 8; f++) {
      const fAngle = (f / 8) * Math.PI * 2;
      const bladeMesh = new THREE.Mesh(bladeGeo, bronzeMat);
      bladeMesh.position.set(0, Math.sin(fAngle) * 0.45, Math.cos(fAngle) * 0.45);
      bladeMesh.rotation.x = fAngle + 0.35; // Pitch angle
      fanImpellerGroup.add(bladeMesh);
    }
    shaftRotatingGroup.add(fanImpellerGroup);

    rootGroup.add(shaftRotatingGroup);
  };

  const isRunning = sensorData?.motorRunning ?? false;
  const rpmValue = sensorData?.rpm ?? 0;
  const tempValue = sensorData?.temperatureC ?? 0;
  const vibValue = sensorData
    ? Math.sqrt(
        sensorData.accelX * sensorData.accelX +
        sensorData.accelY * sensorData.accelY +
        sensorData.accelZ * sensorData.accelZ
      ).toFixed(2)
    : '--';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[460px] lg:h-[540px] bg-[#0b0f17] border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl select-none"
    >
      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* WebGL Fallback Notification if needed */}
      {webglError && (
        <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-30">
          <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">WebGL 3D Fallback Mode</h3>
          <p className="text-xs text-slate-400 max-w-md mb-4">{webglError}</p>
          <div className="text-xs font-mono text-cyan-400 border border-cyan-800/50 bg-cyan-950/40 px-3 py-2 rounded">
            Motor State: {isRunning ? `RUNNING (${rpmValue} RPM)` : 'STOPPED'} · Temp: {tempValue}°C
          </div>
        </div>
      )}

      {/* Top Floating Telemetry Callout Strip */}
      {showCallouts && (
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs font-mono">
            <span className="text-slate-400">ROTOR:</span>
            <span className={isRunning ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
              {isRunning ? `${rpmValue} RPM` : 'STOPPED'}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">TEMP:</span>
            <span
              className={
                tempValue > 70 ? 'text-rose-400 font-semibold' : tempValue > 55 ? 'text-amber-400' : 'text-slate-200'
              }
            >
              {tempValue}°C
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">VIB:</span>
            <span className="text-slate-200">{vibValue} g</span>
          </div>

          {/* Fault Indicator Tag */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono backdrop-blur-md ${
              aiDiagnosis?.severity === 'CRITICAL'
                ? 'bg-rose-950/80 border-rose-600/80 text-rose-300'
                : aiDiagnosis?.severity === 'WARNING'
                ? 'bg-amber-950/80 border-amber-600/80 text-amber-300'
                : 'bg-emerald-950/70 border-emerald-600/60 text-emerald-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>
              {aiDiagnosis?.severity === 'CRITICAL'
                ? 'CRITICAL FAULT'
                : aiDiagnosis?.severity === 'WARNING'
                ? 'MAINTENANCE ALERT'
                : 'NOMINAL TWIN'}
            </span>
          </div>
        </div>
      )}

      {/* Floating 3D Component Labels / Hotspots */}
      {showCallouts && !isExploded && (
        <>
          <button
            onClick={() => onSelectComponent('stator')}
            className="absolute top-[42%] left-[45%] -translate-x-1/2 -translate-y-1/2 pointer-events-auto group flex items-center gap-1.5 bg-slate-950/80 hover:bg-cyan-950/90 border border-slate-700 hover:border-cyan-500/80 text-[11px] font-mono px-2 py-1 rounded transition-colors shadow-lg"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span className="text-slate-300 group-hover:text-cyan-200">Stator Core</span>
          </button>

          <button
            onClick={() => onSelectComponent('drive_bearing')}
            className="absolute top-[48%] right-[22%] pointer-events-auto group flex items-center gap-1.5 bg-slate-950/80 hover:bg-cyan-950/90 border border-slate-700 hover:border-cyan-500/80 text-[11px] font-mono px-2 py-1 rounded transition-colors shadow-lg"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span className="text-slate-300 group-hover:text-cyan-200">DE Bearing</span>
          </button>

          <button
            onClick={() => onSelectComponent('cooling_fan')}
            className="absolute top-[48%] left-[16%] pointer-events-auto group flex items-center gap-1.5 bg-slate-950/80 hover:bg-cyan-950/90 border border-slate-700 hover:border-cyan-500/80 text-[11px] font-mono px-2 py-1 rounded transition-colors shadow-lg"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span className="text-slate-300 group-hover:text-cyan-200">Cooling Shroud</span>
          </button>
        </>
      )}

      {/* Bottom Control Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-auto">
        {/* Left: Camera Angles & Reset */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1 rounded-lg">
          <button
            onClick={() => applyCameraPreset('iso')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              cameraPreset === 'iso' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ISO
          </button>
          <button
            onClick={() => applyCameraPreset('front')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              cameraPreset === 'front' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            FRONT
          </button>
          <button
            onClick={() => applyCameraPreset('side')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              cameraPreset === 'side' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SIDE
          </button>
          <button
            onClick={() => applyCameraPreset('top')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              cameraPreset === 'top' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            TOP
          </button>
          <div className="w-px h-4 bg-slate-800 mx-0.5" />
          <button
            onClick={() => applyCameraPreset('iso')}
            title="Reset Camera"
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Feature Toggles */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1 rounded-lg">
          {/* Pause / Resume Spin */}
          <button
            onClick={() => setIsRotating(!isRotating)}
            title={isRotating ? 'Pause Shaft Rotation' : 'Resume Shaft Rotation'}
            className={`p-1.5 rounded transition-colors ${
              isRotating ? 'text-cyan-400 bg-cyan-950/60' : 'text-slate-400 hover:text-white'
            }`}
          >
            {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {/* Exploded View Toggle */}
          <button
            onClick={() => setIsExploded(!isExploded)}
            title="Exploded CAD Inspection View"
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded transition-colors ${
              isExploded
                ? 'bg-amber-600/90 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>EXPLODE</span>
          </button>

          {/* Toggle Labels */}
          <button
            onClick={() => setShowCallouts(!showCallouts)}
            title="Toggle Component Callout Tags"
            className={`p-1.5 rounded transition-colors ${
              showCallouts ? 'text-cyan-400 bg-cyan-950/60' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Orbit Helper Tip */}
      <div className="absolute top-4 right-4 pointer-events-none hidden md:block">
        <span className="text-[10px] font-mono text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
          Left Drag: Rotate · Scroll: Zoom
        </span>
      </div>
    </div>
  );
});
