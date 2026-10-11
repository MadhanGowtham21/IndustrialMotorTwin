/**
 * Unity AR Digital Twin Integration Bridge Modal
 * Provides C# AR Foundation integration script, WebSocket telemetry schema, and AR configuration.
 */

import React, { useState } from 'react';
import { X, Copy, Check, Layers, Code, Cpu, ExternalLink, ArrowRight } from 'lucide-react';
import { Esp32SensorData } from '../types/telemetry';

interface UnityArBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  latestSensorData: Esp32SensorData | null;
}

export const UnityArBridgeModal: React.FC<UnityArBridgeModalProps> = ({
  isOpen,
  onClose,
  latestSensorData,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'schema' | 'csharp' | 'setup'>('csharp');

  if (!isOpen) return null;

  const unityJsonSample = JSON.stringify(
    {
      motorId: 'IND-MOTOR-400V-01',
      timestamp: latestSensorData?.updatedAt || Date.now(),
      rpm: latestSensorData?.rpm || 1780,
      shaftAngularVelocityRadS: Number((((latestSensorData?.rpm || 1780) * 2 * Math.PI) / 60).toFixed(2)),
      temperatureC: latestSensorData?.temperatureC || 42.1,
      vibrationMagnitudeG: latestSensorData
        ? Number(
            Math.sqrt(
              latestSensorData.accelX * latestSensorData.accelX +
              latestSensorData.accelY * latestSensorData.accelY +
              latestSensorData.accelZ * latestSensorData.accelZ
            ).toFixed(3)
          )
        : 0.28,
      status: latestSensorData?.motorRunning ? 'RUNNING' : 'STOPPED',
      heatmapColorHex:
        (latestSensorData?.temperatureC ?? 0) > 70 ? '#EF4444' : (latestSensorData?.temperatureC ?? 0) > 55 ? '#F59E0B' : '#10B981',
      unityTransform: {
        rotorRotationAxis: [1, 0, 0],
        vibrationJitterMagnitude: 0.002,
      },
    },
    null,
    2
  );

  const csharpCode = `// MotorTwinReceiver.cs - Unity AR Foundation / HoloLens Digital Twin Client
using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

[System.Serializable]
public class MotorTwinPayload
{
    public string motorId;
    public float rpm;
    public float shaftAngularVelocityRadS;
    public float temperatureC;
    public float vibrationMagnitudeG;
    public string status;
    public string heatmapColorHex;
}

public class MotorTwinReceiver : MonoBehaviour
{
    [Header("Digital Twin Hardware Targets")]
    public Transform rotorShaftTransform;
    public Renderer statorMeshRenderer;
    public ParticleSystem warningParticleEffect;

    [Header("Telemetry Bridge Config")]
    public string bridgeApiUrl = "https://industrialmotortwin-default-rtdb.asia-southeast1.firebasedatabase.app/motor/latest.json";
    public float pollIntervalSeconds = 0.2f;

    private float currentShaftSpeed = 0f;

    void Start()
    {
        StartCoroutine(PollTelemetryRoutine());
    }

    void Update()
    {
        // Rotate rotor shaft in Unity AR space smoothly
        if (rotorShaftTransform != null && currentShaftSpeed > 0f)
        {
            rotorShaftTransform.Rotate(Vector3.right, currentShaftSpeed * Time.deltaTime * Mathf.Rad2Deg);
        }
    }

    IEnumerator PollTelemetryRoutine()
    {
        while (true)
        {
            using (UnityWebRequest req = UnityWebRequest.Get(bridgeApiUrl))
            {
                yield return req.SendWebRequest();
                if (req.result == UnityWebRequest.Result.Success)
                {
                    MotorTwinPayload payload = JsonUtility.FromJson<MotorTwinPayload>(req.downloadHandler.text);
                    ApplyDigitalTwinState(payload);
                }
            }
            yield return new WaitForSeconds(pollIntervalSeconds);
        }
    }

    void ApplyDigitalTwinState(MotorTwinPayload data)
    {
        currentShaftSpeed = data.shaftAngularVelocityRadS;

        // Apply thermal shader color to AR motor body
        if (statorMeshRenderer != null && ColorUtility.TryParseHtmlString(data.heatmapColorHex, out Color heatColor))
        {
            statorMeshRenderer.material.SetColor("_EmissionColor", heatColor * 0.8f);
        }
    }
}`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#0f172a] border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Unity AR Digital Twin Integration Bridge
              </h2>
              <div className="text-xs text-slate-400 mt-0.5">
                Real-time spatial mapping & AR holographic synchronization
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800 bg-slate-900/20">
          <button
            onClick={() => setActiveTab('csharp')}
            className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'csharp'
                ? 'border-cyan-500 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Unity C# Script (Receiver)
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'schema'
                ? 'border-cyan-500 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            AR Telemetry JSON Schema
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'setup'
                ? 'border-cyan-500 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            AR Headset Deployment Guide
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          {activeTab === 'csharp' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">Assets/Scripts/MotorTwinReceiver.cs</span>
                <button
                  onClick={() => handleCopy(csharpCode)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 rounded-md border border-slate-700 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Script' : 'Copy C# Code'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-[360px]">
                {csharpCode}
              </pre>
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">Live JSON Streaming Payload</span>
                <button
                  onClick={() => handleCopy(unityJsonSample)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 rounded-md border border-slate-700 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed">
                {unityJsonSample}
              </pre>
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="space-y-3 text-xs text-slate-300">
              <h4 className="font-semibold text-white">How to connect your Unity AR Application:</h4>
              <ol className="space-y-2 list-decimal list-inside leading-relaxed text-slate-300">
                <li>
                  <strong className="text-white">Import AR Foundation:</strong> Install the Unity AR Foundation and
                  OpenXR / ARCore packages via Unity Package Manager.
                </li>
                <li>
                  <strong className="text-white">Place 3D Motor Prefab:</strong> Import your CAD 3D motor model (FBX/OBJ)
                  into Unity and assign separate child transforms for the <code>rotorShaft</code> and{' '}
                  <code>statorHousing</code>.
                </li>
                <li>
                  <strong className="text-white">Attach MotorTwinReceiver:</strong> Attach the script to your motor GameObject
                  and drag the transforms into the inspector slots.
                </li>
                <li>
                  <strong className="text-white">Image Target or Spatial Anchor:</strong> Use an AR Tracked Image (e.g. QR code
                  on physical motor nameplate) to align the holographic digital twin over the physical motor on site.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/40 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Close Bridge
          </button>
        </div>
      </div>
    </div>
  );
};
