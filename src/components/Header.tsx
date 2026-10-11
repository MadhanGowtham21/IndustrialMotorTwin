/**
 * MotorTwin AI - Industrial Control Center Header
 * Clean 3-zone Top Bar Contract with contextual telemetry sub-strip.
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  Settings,
  Bell,
  Cpu,
  Power,
  Database,
  Radio,
  Server,
} from 'lucide-react';
import { DataSourceMode, Esp32SensorData, AiDiagnosisResult } from '../types/telemetry';
import { RtdbStatus } from '../services/firebaseRtdb';
import { FastApiStatus } from '../services/fastApiService';

interface HeaderProps {
  dataSourceMode: DataSourceMode;
  rtdbStatus: RtdbStatus;
  sensorData: Esp32SensorData | null;
  aiDiagnosis: AiDiagnosisResult | null;
  unreadAlertsCount: number;
  fastApiStatus: FastApiStatus;
  onOpenSettings: () => void;
  onOpenUnityBridge: () => void;
  onOpenAlerts: () => void;
  onOpenFastApiControl: () => void;
  activeNavTab: string;
  onSelectNavTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  dataSourceMode,
  rtdbStatus,
  sensorData,
  aiDiagnosis,
  unreadAlertsCount,
  fastApiStatus,
  onOpenSettings,
  onOpenUnityBridge,
  onOpenAlerts,
  onOpenFastApiControl,
  activeNavTab,
  onSelectNavTab,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
          ' ' +
          now.toLocaleTimeString('en-US', { hour12: false })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const isRtdbConnected = rtdbStatus.state === 'CONNECTED';
  const isEsp32Live = rtdbStatus.isRealHardwareOnline;
  const isMotorRunning = sensorData?.motorRunning ?? false;

  return (
    <header className="border-b border-slate-800 bg-[#0e1422] sticky top-0 z-40">
      {/* 1. Main Navigation Bar (3-Zone Contract) */}
      <div className="flex items-center justify-between gap-8 px-4 sm:px-6 py-3">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-wider text-white whitespace-nowrap">
              MOTOR TWIN AI
            </span>
            <div className="text-[10px] text-slate-400 hidden sm:block">
              Industrial Motor Intelligence & Predictive Maintenance
            </div>
          </div>
        </div>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'twin', label: '3D Twin' },
            { id: 'trends', label: 'Analytics' },
            { id: 'diagnosis', label: 'AI Diagnosis' },
            { id: 'simulation', label: 'Simulation Testbench' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => onSelectNavTab(tab.id)}
              className={`hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeNavTab === tab.id
                  ? 'text-cyan-400 border-b border-cyan-400 font-semibold'
                  : 'border-b border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Primary Actions & Utility Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Live Backend Controller Toggle Button */}
          <button
            onClick={onOpenFastApiControl}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-lg border transition-all ${
              fastApiStatus.isOnline
                ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 ring-1 ring-emerald-500/30'
                : 'bg-amber-950/80 border-amber-600/80 text-amber-300'
            }`}
            title="Configure Machine Learning Backend (Cloud API / FastAPI)"
          >
            <Server className={`w-3.5 h-3.5 ${fastApiStatus.isOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="hidden sm:inline">
              BACKEND: {fastApiStatus.isOnline ? 'LIVE' : 'OFFLINE'}
            </span>
            <span className="sm:hidden">
              {fastApiStatus.isOnline ? 'API ON' : 'API OFF'}
            </span>
          </button>

          {/* Unity AR Bridge CTA */}
          <button
            onClick={onOpenUnityBridge}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Unity AR Bridge</span>
            <span className="sm:hidden">AR</span>
          </button>

          {/* Incident Alert Bell with Counter */}
          <button
            onClick={onOpenAlerts}
            title="Incident Alarm Logs"
            className="relative p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-mono flex items-center justify-center font-bold">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {/* RTDB Hardware Settings */}
          <button
            onClick={onOpenSettings}
            title="Firebase RTDB Connection Settings"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Industrial Telemetry & Status Strip */}
      <div className="px-4 sm:px-6 py-1.5 bg-[#0a0e18] border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-y-1">
        {/* Left Status Indicators */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Operating Mode Indicator */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 uppercase">MODE:</span>
            <span
              className={`font-semibold ${
                dataSourceMode === 'LIVE_ESP32' ? 'text-emerald-400' : 'text-cyan-400'
              }`}
            >
              {dataSourceMode === 'LIVE_ESP32' ? 'LIVE DATA' : 'SIMULATED DATA'}
            </span>
          </div>

          <span className="text-slate-700 hidden sm:inline">|</span>

          {/* Firebase Status */}
          <div className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-slate-500" />
            <span className="text-slate-500">FIREBASE:</span>
            <span
              className={
                isRtdbConnected ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'
              }
            >
              {isRtdbConnected ? 'CONNECTED' : rtdbStatus.state}
            </span>
          </div>

          <span className="text-slate-700 hidden sm:inline">|</span>

          {/* ESP32 Hardware Status */}
          <div className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-slate-500" />
            <span className="text-slate-500">ESP32:</span>
            <span
              className={
                dataSourceMode === 'SIMULATED'
                  ? 'text-cyan-400'
                  : isEsp32Live
                  ? 'text-emerald-400 font-semibold'
                  : 'text-amber-400'
              }
            >
              {dataSourceMode === 'SIMULATED' ? 'BENCH SIM' : isEsp32Live ? 'TRANSMITTING' : 'IDLE / NO SIGNAL'}
            </span>
          </div>

          <span className="text-slate-700 hidden md:inline">|</span>

          {/* Motor State */}
          <div className="hidden md:flex items-center gap-1.5">
            <Power className="w-3 h-3 text-slate-500" />
            <span className="text-slate-500">MOTOR:</span>
            <span className={isMotorRunning ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
              {isMotorRunning ? `RUNNING (${sensorData?.rpm} RPM)` : 'STOPPED'}
            </span>
          </div>

          <span className="text-slate-700 hidden lg:inline">|</span>

          {/* AI / Live Backend Status Button */}
          <button
            onClick={onOpenFastApiControl}
            className="flex items-center gap-1.5 hover:underline cursor-pointer"
            title="Click to view Backend server status & options"
          >
            <Server className="w-3 h-3 text-slate-500" />
            <span className="text-slate-500">BACKEND:</span>
            <span
              className={
                fastApiStatus.isOnline
                  ? 'text-emerald-400 font-semibold'
                  : 'text-amber-400 font-semibold'
              }
            >
              {fastApiStatus.mode === 'LIVE_FASTAPI_RENDER'
                ? fastApiStatus.isOnline
                  ? `LIVE RENDER FASTAPI (${fastApiStatus.lastPingMs || 0}ms)`
                  : 'CONNECTING TO RENDER...'
                : fastApiStatus.mode === 'LIVE_BACKEND_API'
                ? fastApiStatus.isOnline
                  ? `LIVE BACKEND API (${fastApiStatus.lastPingMs || 0}ms)`
                  : 'BACKEND OFFLINE'
                : fastApiStatus.mode === 'LIVE_FASTAPI_LOCAL'
                ? fastApiStatus.isOnline
                  ? `LIVE LOCAL FASTAPI (${fastApiStatus.lastPingMs || 0}ms)`
                  : 'LOCAL FASTAPI OFFLINE'
                : 'IN-APP ML ENGINE'}
            </span>
          </button>
        </div>

        {/* Right Timestamp */}
        <div className="text-slate-400 text-[11px] tabular-nums">
          <span>{currentTime}</span>
        </div>
      </div>
    </header>
  );
};
