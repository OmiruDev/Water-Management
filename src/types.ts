export type PumpState = 'ON' | 'OFF';
export type DeviceConnectionStatus = 'online' | 'offline' | 'degraded';

export interface TelemetryReading {
  id?: string;
  deviceId: string;
  timestamp: string; // ISO string
  waterPercentage: number; // 0 to 100
  distance_cm: number; // Sensor distance to water surface
  waterVolumeLiters: number; // Litres in tank
  maxVolumeLiters: number; // Max capacity
  pumpState: PumpState;
  flowRateLpm: number; // Flow rate in L/min
  rssi: number; // dBm WiFi signal
  batteryVoltage?: number; // V
  temperatureC?: number; // Ambient or water temp
  isSimulated?: boolean;
}

export interface HistoricalDataPoint {
  timestamp: string;
  label: string; // e.g. "14:00" or "Mon"
  waterPercentage: number;
  waterVolumeLiters: number;
  consumptionLiters: number;
  pumpMinutesActive: number;
  pumpEnergyKWh: number;
  pumpState: PumpState;
}

export interface SystemConfig {
  deviceId: string;
  deviceName: string;
  tankHeightCm: number;
  tankRadiusCm: number;
  sensorOffsetCm: number;
  pumpOnPercent: number; // Auto trigger refill below this
  pumpOffPercent: number; // Auto cutoff pump above this
  pumpFlowRateLpm: number; // Litres per minute when pump is active
  pumpPowerWatts: number; // Power rating in Watts
  electricityCostPerKWh: number; // Currency cost
  autoMode: boolean; // Auto pump control by setpoints
  soundAlertsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  leakDetectionThresholdLph: number; // Litres/hr drop threshold
}

export type AlertType = 
  | 'critical_low' 
  | 'overflow_risk' 
  | 'leak_detected' 
  | 'device_offline' 
  | 'dry_run_prevented' 
  | 'ai_warning'
  | 'info';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface SystemAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  metricValue?: string | number;
}

export interface AILeakAnalysis {
  leakDetected: boolean;
  confidenceScore: number; // 0 - 100
  estimatedLossRateLph: number; // Litres per hour
  dropRatePercentPerHr: number;
  severity: 'none' | 'low' | 'moderate' | 'critical';
  explanation: string;
  recommendedAction: string;
  timestamp: string;
}

export interface AIPrediction {
  hoursUntilDry: number | null;
  predictedDryTimestamp: string | null;
  suggestedRefillTime: string;
  peakUsageWindow: string;
  dailyConsumptionEstimateLiters: number;
  smartScheduleAdvice: string;
  efficiencyScore: number; // 0 - 100
  insights: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  suggestedQuestions?: string[];
}
