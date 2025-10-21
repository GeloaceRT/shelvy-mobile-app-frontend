import React, { createContext, useContext, useMemo, useState } from 'react';

const TelemetryContext = createContext(null);

const now = new Date();
const isoNow = now.toISOString();

const STATIC_DEVICES = [
  {
    id: 'casing-1',
    name: 'Casing 1',
    location: 'Bakery Floor · Section A',
    temperature: 25.4,
    humidity: 62,
    battery: 84,
    status: 'online',
    isActive: true,
    lastUpdated: isoNow,
  },
  {
    id: 'casing-2',
    name: 'Casing 2',
    location: 'Proofing Room',
    temperature: 23.8,
    humidity: 58,
    battery: 67,
    status: 'standby',
    isActive: false,
    lastUpdated: isoNow,
  },
  {
    id: 'casing-3',
    name: 'Casing 3',
    location: 'Storage · Section C',
    temperature: 27.1,
    humidity: 64,
    battery: 49,
    status: 'standby',
    isActive: false,
    lastUpdated: isoNow,
  },
];

const STATIC_ALERTS = [
  {
    id: 'alert-1',
    deviceId: 'casing-1',
    title: 'High temperature resolved',
    severity: 'success',
    timestamp: isoNow,
    value: 'Back in range',
  },
  {
    id: 'alert-2',
    deviceId: 'casing-3',
    title: 'Low humidity noted',
    severity: 'warning',
    timestamp: isoNow,
    value: '64% humidity',
  },
  {
    id: 'alert-3',
    deviceId: 'casing-2',
    title: 'Device ping healthy',
    severity: 'success',
    timestamp: isoNow,
    value: 'Signal stable',
  },
];

const STATIC_LOGS = [
  {
    id: 'log-1',
    timestamp: isoNow,
    deviceId: 'casing-1',
    event: 'Telemetry stream started',
    type: 'info',
  },
  {
    id: 'log-2',
    timestamp: isoNow,
    deviceId: 'casing-1',
    event: 'Ping 25.4°C / 62%',
    type: 'metric',
  },
  {
    id: 'log-3',
    timestamp: isoNow,
    deviceId: 'casing-3',
    event: 'Alert generated: Low humidity noted',
    type: 'alert',
  },
  {
    id: 'log-4',
    timestamp: isoNow,
    deviceId: 'casing-2',
    event: 'Device set to standby mode',
    type: 'info',
  },
];

const STATIC_HISTORY = [
  {
    id: 'reading-1',
    deviceId: 'casing-1',
    temperature: 25.4,
    humidity: 62,
    timestamp: isoNow,
  },
  {
    id: 'reading-2',
    deviceId: 'casing-1',
    temperature: 25.7,
    humidity: 61.5,
    timestamp: isoNow,
  },
  {
    id: 'reading-3',
    deviceId: 'casing-1',
    temperature: 26.1,
    humidity: 60.8,
    timestamp: isoNow,
  },
  {
    id: 'reading-4',
    deviceId: 'casing-2',
    temperature: 23.8,
    humidity: 58,
    timestamp: isoNow,
  },
  {
    id: 'reading-5',
    deviceId: 'casing-3',
    temperature: 27.1,
    humidity: 64,
    timestamp: isoNow,
  },
];

const INITIAL_STATE = {
  summary: {
    temperature: STATIC_DEVICES[0].temperature,
    humidity: STATIC_DEVICES[0].humidity,
    temperatureTrend: 0.3,
    humidityTrend: -1.1,
    lastUpdated: STATIC_DEVICES[0].lastUpdated,
    deviceId: STATIC_DEVICES[0].id,
  },
  devices: STATIC_DEVICES,
  alerts: STATIC_ALERTS,
  logs: STATIC_LOGS,
  history: STATIC_HISTORY,
  activeDeviceId: STATIC_DEVICES[0].id,
  lastUpdated: isoNow,
};

export function TelemetryProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE);

  const setActiveDevice = (deviceId) => {
    setState((prev) => {
      if (!deviceId || !prev.devices.some((device) => device.id === deviceId)) {
        return prev;
      }

      if (prev.activeDeviceId === deviceId) {
        return prev;
      }

      const devices = prev.devices.map((device) => ({
        ...device,
        isActive: device.id === deviceId,
        status: device.id === deviceId ? 'online' : device.status,
      }));

      const active = devices.find((device) => device.id === deviceId);
      if (!active) {
        return prev;
      }

      return {
        ...prev,
        devices,
        activeDeviceId: deviceId,
        summary: {
          ...prev.summary,
          temperature: active.temperature,
          humidity: active.humidity,
          temperatureTrend: 0,
          humidityTrend: 0,
          lastUpdated: active.lastUpdated,
          deviceId: deviceId,
        },
      };
    });
  };

  const contextValue = useMemo(
    () => ({
      ...state,
      setActiveDevice,
    }),
    [state]
  );

  return <TelemetryContext.Provider value={contextValue}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);

  if (!context) {
    throw new Error('useTelemetry must be used within TelemetryProvider');
  }

  return context;
}
