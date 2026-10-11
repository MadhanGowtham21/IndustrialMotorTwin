/**
 * MotorTwin AI - Industrial Predictive Maintenance & Interactive 3D Digital Twin Dashboard
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Activity,
  Layers,
  Settings,
  AlertTriangle,
  Play,
  RotateCcw,
  Sliders,
  CheckCircle,
  Cpu,
  RefreshCw,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Esp32SensorData,
  AiDiagnosisResult,
  DataSourceMode,
  TelemetryHistoryPoint,
  IncidentAlert,
} from './types/telemetry';
import { firebaseRtdbService, RtdbStatus } from './services/firebaseRtdb';
import { IndustrialMlEngine } from './services/mlEngine';
import { industrialSimulationEngine, SimulationPreset } from './services/simulationEngine';
import { Header } from './components/Header';
import { KpiStrip } from './components/KpiStrip';
import { Motor3DViewer } from './components/Motor3DViewer';
import { SensorCharts } from './components/SensorCharts';
import { AiFaultDiagnosis } from './components/AiFaultDiagnosis';
import { SimulationWorkbench } from './components/SimulationWorkbench';
import { ComponentInspectorModal } from './components/ComponentInspectorModal';
import { FirebaseSettingsModal } from './components/FirebaseSettingsModal';
import { UnityArBridgeModal } from './components/UnityArBridgeModal';
import { AlertsFlyout } from './components/AlertsFlyout';
import { FastApiDocsModal } from './components/FastApiDocsModal';
import { FastApiBackendControlModal } from './components/FastApiBackendControlModal';
import { fastApiService, FastApiStatus } from './services/fastApiService';

export default function App() {
  // Primary App States - Default to LIVE_ESP32 for real-time ESP32 hardware streaming
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('LIVE_ESP32');
  const [rtdbStatus, setRtdbStatus] = useState<RtdbStatus>(firebaseRtdbService.getStatus());
  const [fastApiStatus, setFastApiStatus] = useState<FastApiStatus>(fastApiService.getStatus());
  const [latestSensorData, setLatestSensorData] = useState<Esp32SensorData | null>(null);
  const [aiDiagnosis, setAiDiagnosis] = useState<AiDiagnosisResult | null>(null);
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>([]);
  const [alerts, setAlerts] = useState<IncidentAlert[]>([]);
  const [activePreset, setActivePreset] = useState<SimulationPreset>('NOMINAL_RUN');
  const [activeNavTab, setActiveNavTab] = useState<string>('dashboard');

  // Modal / Flyout States
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [isUnityModalOpen, setIsUnityModalOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isFastApiModalOpen, setIsFastApiModalOpen] = useState(false);
  const [isFastApiControlOpen, setIsFastApiControlOpen] = useState(false);

  // References for rate-limiting alerts & history points
  const lastAlertTimeRef = useRef<number>(0);
  const lastAlertClassRef = useRef<string>('');
  const lastHistoryTimeRef = useRef<number>(0);
  const dataSourceModeRef = useRef<DataSourceMode>(dataSourceMode);
  dataSourceModeRef.current = dataSourceMode;

  // Listen to FastAPI Status updates
  useEffect(() => {
    const unsub = fastApiService.onStatusChange(s => setFastApiStatus(s));
    return unsub;
  }, []);

  // 1. Process New Telemetry Packet
  const handleNewSensorData = useCallback((data: Esp32SensorData) => {
    setLatestSensorData(data);

    // Run ML Engine via fastApiService (routes to Live FastAPI if enabled, else In-App ML)
    fastApiService.analyzeTelemetry(data).then(diagnosis => {
      setAiDiagnosis(diagnosis);

      // Generate Incident Alert if anomaly detected and de-duplicated
      if (diagnosis.anomalyDetected && diagnosis.severity !== 'NOMINAL') {
        const nowMs = Date.now();
        const shouldTrigger =
          nowMs - lastAlertTimeRef.current > 8000 || lastAlertClassRef.current !== diagnosis.predictedClass;

        if (shouldTrigger) {
          lastAlertTimeRef.current = nowMs;
          lastAlertClassRef.current = diagnosis.predictedClass;

          const newAlert: IncidentAlert = {
            id: `alert-${nowMs}-${Math.random().toString(36).substr(2, 4)}`,
            timestamp: nowMs,
            severity: diagnosis.severity,
            title: `${diagnosis.predictedClass} Triggered`,
            detail: diagnosis.evidenceSummary,
            sensor: diagnosis.affectedComponent.replace('_', ' ').toUpperCase(),
            acknowledged: false,
          };

          setAlerts(prev => [newAlert, ...prev].slice(0, 50));
        }
      }
    });

    // Compute vibration magnitude
    const vibG = data.mpuOK
      ? Number(Math.sqrt(data.accelX ** 2 + data.accelY ** 2 + data.accelZ ** 2).toFixed(2))
      : 0;

    // Append to rolling history (throttled to at most once per 1000ms to preserve UI responsiveness)
    const nowMs = Date.now();
    if (nowMs - lastHistoryTimeRef.current >= 1000) {
      lastHistoryTimeRef.current = nowMs;
      const dateObj = new Date(data.updatedAt || nowMs);
      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setHistory(prev => {
        const next = [
          ...prev,
          {
            timestamp: data.updatedAt || nowMs,
            timeStr,
            temperatureC: data.temperatureC,
            rpm: data.rpm,
            vibrationG: vibG,
            voltageV: data.voltageV,
            currentA: data.currentA,
            motorPWM: data.motorPWM,
            isAnomaly: (vibG > 1.8 || data.temperatureC > 70),
          },
        ];
        return next.slice(-150);
      });
    }
  }, []);

  // 2. Firebase RTDB Service Lifecycle (Mount once, clean on unmount)
  useEffect(() => {
    firebaseRtdbService.onStatusChange(status => {
      setRtdbStatus(status);
    });

    firebaseRtdbService.onData(data => {
      if (dataSourceModeRef.current === 'LIVE_ESP32') {
        handleNewSensorData(data);
      }
    });

    // Start connection to the provided RTDB cluster
    firebaseRtdbService.connect();

    return () => {
      firebaseRtdbService.disconnect();
    };
  }, [handleNewSensorData]);

  // 3. Digital Twin Simulation Loop (runs only when in SIMULATED mode)
  useEffect(() => {
    if (dataSourceMode !== 'SIMULATED') return;

    // Simulation tick at 2 Hz
    const interval = setInterval(() => {
      const sample = industrialSimulationEngine.step();
      handleNewSensorData(sample);
    }, 500);

    return () => clearInterval(interval);
  }, [dataSourceMode, handleNewSensorData]);

  // Initial seed if empty
  useEffect(() => {
    if (!latestSensorData) {
      const initial = industrialSimulationEngine.step();
      handleNewSensorData(initial);
    }
  }, [latestSensorData, handleNewSensorData]);

  // Export CSV handler
  const handleExportCsv = () => {
    if (history.length === 0) return;
    const headers = ['Timestamp', 'Time', 'Temperature_C', 'RPM', 'Vibration_G', 'Voltage_V', 'Current_A', 'PWM', 'IsAnomaly'];
    const rows = history.map(h => [
      h.timestamp,
      h.timeStr,
      h.temperatureC,
      h.rpm,
      h.vibrationG,
      h.voltageV,
      h.currentA,
      h.motorPWM,
      h.isAnomaly ? 1 : 0,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `motortwin_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Check if data is stale
  const isStale =
    dataSourceMode === 'LIVE_ESP32' &&
    (!latestSensorData?.updatedAt || Date.now() - latestSensorData.updatedAt > 15000);

  const unreadAlerts = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        dataSourceMode={dataSourceMode}
        rtdbStatus={rtdbStatus}
        fastApiStatus={fastApiStatus}
        sensorData={latestSensorData}
        aiDiagnosis={aiDiagnosis}
        unreadAlertsCount={unreadAlerts}
        onOpenSettings={() => setIsFirebaseModalOpen(true)}
        onOpenUnityBridge={() => setIsUnityModalOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenFastApiControl={() => setIsFastApiControlOpen(true)}
        activeNavTab={activeNavTab}
        onSelectNavTab={setActiveNavTab}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* KPI Telemetry Cards */}
        <section aria-label="Motor Telemetry KPIs">
          <KpiStrip
            sensorData={latestSensorData}
            aiDiagnosis={aiDiagnosis}
            dataSourceMode={dataSourceMode}
            isStale={isStale}
            onOpenDiagnosis={() => setActiveNavTab('diagnosis')}
          />
        </section>

        {/* Tab-driven View Layout */}
        {activeNavTab === 'dashboard' && (
          <div className="space-y-5">
            {/* Split Grid: Central 3D Digital Twin & AI Fault Diagnostics */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* 3D Digital Twin Viewer (7 Cols) */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold tracking-tight text-white uppercase font-mono">
                      CAD Induction Motor Digital Twin
                    </h2>
                    <span className="text-xs text-slate-500 font-mono">
                      (NEMA 184T Frame · 3.7 kW / 5 HP)
                    </span>
                  </div>
                  <span className="text-xs text-cyan-400 font-mono">
                    Click any component to inspect
                  </span>
                </div>
                <Motor3DViewer
                  sensorData={latestSensorData}
                  aiDiagnosis={aiDiagnosis}
                  onSelectComponent={setSelectedComponentId}
                  selectedComponentId={selectedComponentId}
                />
              </div>

              {/* AI Predictive Anomaly Diagnosis (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold tracking-tight text-white uppercase font-mono">
                    ISO-10816 Anomaly Classifier
                  </h2>
                  <span className="text-xs text-slate-400 font-mono">
                    Real-time Inference
                  </span>
                </div>
                <AiFaultDiagnosis
                  diagnosis={aiDiagnosis}
                  dataSourceMode={dataSourceMode}
                  onOpenFastApiDocs={() => setIsFastApiModalOpen(true)}
                  onOpenFastApiControl={() => setIsFastApiControlOpen(true)}
                />
              </div>
            </div>

            {/* Sensor Trends Section */}
            <section aria-label="Sensor Trends">
              <SensorCharts historyData={history} onExportCsv={handleExportCsv} />
            </section>

            {/* Simulation & Fault Injection Testbench */}
            <section aria-label="Fault Injection Testbench">
              <SimulationWorkbench
                dataSourceMode={dataSourceMode}
                onSetDataSourceMode={setDataSourceMode}
                onPresetSelect={setActivePreset}
                activePreset={activePreset}
              />
            </section>
          </div>
        )}

        {/* Tab 2: 3D Twin View Only */}
        {activeNavTab === 'twin' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Full-Screen 3D Motor Spatial Inspector</h2>
                <p className="text-xs text-slate-400">
                  Inspect induction motor kinematics, rotor shaft coupling, bearing assemblies, and thermal dissipation
                </p>
              </div>
              <button
                onClick={() => setIsUnityModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-xs font-medium text-white rounded-lg transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Export to Unity AR</span>
              </button>
            </div>
            <div className="h-[640px]">
              <Motor3DViewer
                sensorData={latestSensorData}
                aiDiagnosis={aiDiagnosis}
                onSelectComponent={setSelectedComponentId}
                selectedComponentId={selectedComponentId}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Sensor Analytics Only */}
        {activeNavTab === 'trends' && (
          <div className="space-y-4">
            <SensorCharts historyData={history} onExportCsv={handleExportCsv} />
          </div>
        )}

        {/* Tab 4: AI Diagnosis Only */}
        {activeNavTab === 'diagnosis' && (
          <div className="space-y-4">
            <AiFaultDiagnosis
              diagnosis={aiDiagnosis}
              dataSourceMode={dataSourceMode}
              onOpenFastApiDocs={() => setIsFastApiModalOpen(true)}
              onOpenFastApiControl={() => setIsFastApiControlOpen(true)}
            />
          </div>
        )}

        {/* Tab 5: Simulation Testbench Only */}
        {activeNavTab === 'simulation' && (
          <div className="space-y-4">
            <SimulationWorkbench
              dataSourceMode={dataSourceMode}
              onSetDataSourceMode={setDataSourceMode}
              onPresetSelect={setActivePreset}
              activePreset={activePreset}
            />
          </div>
        )}
      </main>

      {/* Engineering Footer */}
      <footer className="border-t border-slate-800 bg-[#0a0e18] px-6 py-4 mt-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-400">MotorTwin AI Control Center</span>
          <span aria-hidden="true">·</span>
          <span>ESP32 RTDB Integration</span>
          <span aria-hidden="true">·</span>
          <span>Three.js Spatial Engine</span>
          <span aria-hidden="true">·</span>
          <span>ISO 10816 Diagnostics</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <button
            onClick={() => setIsFastApiModalOpen(true)}
            className="hover:text-cyan-400 transition-colors"
          >
            FastAPI OpenAPI Spec
          </button>
          <button
            onClick={() => setIsUnityModalOpen(true)}
            className="hover:text-cyan-400 transition-colors"
          >
            Unity AR Schema
          </button>
          <button
            onClick={() => setIsFirebaseModalOpen(true)}
            className="hover:text-cyan-400 transition-colors"
          >
            RTDB Config
          </button>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <ComponentInspectorModal
        componentId={selectedComponentId}
        onClose={() => setSelectedComponentId(null)}
        sensorData={latestSensorData}
        aiDiagnosis={aiDiagnosis}
      />

      <FirebaseSettingsModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        status={rtdbStatus}
        latestRawData={latestSensorData}
      />

      <UnityArBridgeModal
        isOpen={isUnityModalOpen}
        onClose={() => setIsUnityModalOpen(false)}
        latestSensorData={latestSensorData}
      />

      <AlertsFlyout
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        alerts={alerts}
        onAcknowledge={id =>
          setAlerts(prev => prev.map(a => (a.id === id ? { ...a, acknowledged: true } : a)))
        }
        onClearAll={() => setAlerts([])}
      />

      <FastApiDocsModal
        isOpen={isFastApiModalOpen}
        onClose={() => setIsFastApiModalOpen(false)}
      />

      <FastApiBackendControlModal
        isOpen={isFastApiControlOpen}
        onClose={() => setIsFastApiControlOpen(false)}
        status={fastApiStatus}
      />
    </div>
  );
}
