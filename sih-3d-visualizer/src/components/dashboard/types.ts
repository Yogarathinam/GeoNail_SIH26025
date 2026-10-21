// =====================================================================
// GeoNail Monitoring System - Industrial Telemetry Types & Contracts
// =====================================================================

export type ConnectionSource = 'simulated' | 'wifi' | 'ble' | 'serial';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'stale';

export type DashboardSection =
  | 'overview'
  | 'telemetry'
  | 'analytics'
  | 'sensors'
  | 'alerts'
  | 'settings';

export interface TelemetrySample {
  id: string;
  timestamp: number;
  formattedTime: string;
  nodeId: string;
  nodeName: string;
  location: string;
  firmware: string;

  // 3D Motion & Kinematics
  roll: number;
  pitch: number;
  yaw: number;
  ax: number;
  ay: number;
  az: number;
  accel: number;
  vibrationRms: number;
  shockPeakG: number;
  vibrationLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A';

  // Subsurface Magnetic & Anchor Displacement
  magneticUt: number;
  magneticCalibrated: boolean;
  displacementMm: number; // Derived estimate: (47.60 - B) * 2.85 mm/uT

  // Underground Environment
  temperatureC: number;
  humidityPercent: number;
  soilRaw: number;
  soilPercent: number;
  mq7Raw: number;
  mq7Ppm: number;

  // Sensor Diagnostics
  mpuStatus: string;
  hmcStatus: string;
  dhtStatus: string;
  soilStatus: string;
  mq7Status: string;

  // System & Edge Analysis
  overallStatus: 'NORMAL' | 'WARNING' | 'CRITICAL';
  healthScore: number;
  anomaly: string;
  isBurst: boolean;

  // System Diagnostics
  uptimeMs: number;
  freeHeap: number;
  packetCount: number;

  // Raw Packet
  rawJson?: string;
  transportSource: ConnectionSource;
}

export interface ExperimentalThresholds {
  tiltWarning: number; // deg (default: 2.0)
  tiltCritical: number; // deg (default: 5.0)
  vibrationWarning: number; // g (default: 0.05)
  vibrationCritical: number; // g (default: 0.15)
  displacementWarning: number; // mm (default: 5.0)
  displacementCritical: number; // mm (default: 15.0)
  mq7WarningPpm: number; // PPM (default: 25.0)
  cooldownSeconds: number; // seconds between emails (default: 60)
  emailAlertsEnabled: boolean;
  recipientEmail: string;
}

export interface IncidentAlertLog {
  id: string;
  timestamp: number;
  formattedTime: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  alertType: string;
  reason: string;
  metricSnapshot: {
    roll: number;
    pitch: number;
    vibrationRms: number;
    shockPeakG: number;
    displacementMm: number;
    temperatureC: number;
  };
  deliveryStatus: 'SENT' | 'FAILED' | 'PENDING' | 'SIMULATED';
  messageId?: string;
  errorMessage?: string;
}

export interface SignalStatistic {
  key: string;
  label: string;
  unit: string;
  category: 'direct' | 'calculated' | 'estimate';
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  baseline: number;
  baselineDeviation: number;
  rateOfChange: number; // per second
  thresholdCrossings: number;
  current: number;
}
