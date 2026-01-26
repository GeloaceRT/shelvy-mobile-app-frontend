import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { fetchLatestReading, fetchReadingAlerts } from '../services/api';

const TelemetryContext = createContext(null);

const CASING_DEVICE_ID = 'casing-1';
const HISTORY_LIMIT = 20;
const LOG_LIMIT = 20;
const POLL_INTERVAL_MS = 5000;
const CRITICAL_SEVERITY = 'warning';
const NOTIFICATION_CHANNEL_ID = 'shelvy-critical-alerts';
const NOTIFICATION_COOLDOWN_MS = 2 * 60 * 1000;
const ALERT_HISTORY_LIMIT = 20;
const VIBRATION_PATTERN = [0, 300, 150, 300, 150, 400];

const isNotificationPermissionGranted = (permissionStatus) =>
  Boolean(
    permissionStatus &&
      (permissionStatus.granted ||
        permissionStatus.status === Notifications.AuthorizationStatus.GRANTED ||
        permissionStatus.status === Notifications.AuthorizationStatus.PROVISIONAL)
  );

let notificationHandlerRegistered = false;

if (!notificationHandlerRegistered) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  notificationHandlerRegistered = true;
}

const createInitialState = () => {
  const now = new Date();
  const isoNow = now.toISOString();

  const devices = [
    {
      id: CASING_DEVICE_ID,
      name: 'Casing 1',
      location: 'Bakery Floor · Section A',
      temperature: 25.4,
      humidity: 62,
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
      status: 'standby',
      isActive: false,
      lastUpdated: isoNow,
    },
  ];

  const summary = {
    temperature: devices[0].temperature,
    humidity: devices[0].humidity,
    temperatureTrend: 0.3,
    humidityTrend: -1.1,
    lastUpdated: devices[0].lastUpdated,
    deviceId: devices[0].id,
  };

  const alerts = [
    {
      id: 'alert-1',
      deviceId: devices[0].id,
      title: 'High temperature resolved',
      severity: 'success',
      timestamp: isoNow,
      value: 'Back in range',
    },
    {
      id: 'alert-2',
      deviceId: devices[2].id,
      title: 'Low humidity noted',
      severity: 'warning',
      timestamp: isoNow,
      value: '64% humidity',
    },
    {
      id: 'alert-3',
      deviceId: devices[1].id,
      title: 'Device ping healthy',
      severity: 'success',
      timestamp: isoNow,
      value: 'Signal stable',
    },
  ];

  const logs = [
    {
      id: 'log-1',
      timestamp: isoNow,
      deviceId: devices[0].id,
      event: 'Telemetry stream started',
      type: 'info',
    },
    {
      id: 'log-2',
      timestamp: isoNow,
      deviceId: devices[0].id,
      event: 'Ping 25.4°C / 62%',
      type: 'metric',
    },
    {
      id: 'log-3',
      timestamp: isoNow,
      deviceId: devices[2].id,
      event: 'Alert generated: Low humidity noted',
      type: 'alert',
    },
    {
      id: 'log-4',
      timestamp: isoNow,
      deviceId: devices[1].id,
      event: 'Device set to standby mode',
      type: 'info',
    },
  ];

  const history = [
    {
      id: 'reading-1',
      deviceId: devices[0].id,
      temperature: devices[0].temperature,
      humidity: devices[0].humidity,
      timestamp: isoNow,
    },
    {
      id: 'reading-2',
      deviceId: devices[0].id,
      temperature: 25.7,
      humidity: 61.5,
      timestamp: isoNow,
    },
    {
      id: 'reading-3',
      deviceId: devices[0].id,
      temperature: 26.1,
      humidity: 60.8,
      timestamp: isoNow,
    },
    {
      id: 'reading-4',
      deviceId: devices[1].id,
      temperature: devices[1].temperature,
      humidity: devices[1].humidity,
      timestamp: isoNow,
    },
    {
      id: 'reading-5',
      deviceId: devices[2].id,
      temperature: devices[2].temperature,
      humidity: devices[2].humidity,
      timestamp: isoNow,
    },
  ];

  return {
    summary,
    devices,
    alerts,
    logs,
    history,
    activeDeviceId: devices[0].id,
    lastUpdated: isoNow,
  };
};

const INITIAL_STATUS = {
  isLive: false,
  isLoading: false,
  error: null,
  lastSyncedAt: null,
};

export function TelemetryProvider({ token, children }) {
  const [state, setState] = useState(() => createInitialState());
  const [status, setStatus] = useState(INITIAL_STATUS);
  const alertHistoryRef = useRef(new Map());
  const notificationsReadyRef = useRef(false);
  const isMountedRef = useRef(true);
  const activeTokenRef = useRef(token ?? null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeTokenRef.current = token ?? null;
  }, [token]);

  useEffect(() => {
    let isActive = true;

    const configureNotifications = async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
            name: 'Shelvy critical alerts',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: VIBRATION_PATTERN,
            sound: 'default',
          });
        }

        const settings = await Notifications.getPermissionsAsync();
        let granted = isNotificationPermissionGranted(settings);

        if (!granted) {
          const request = await Notifications.requestPermissionsAsync();
          granted = isNotificationPermissionGranted(request);
        }

        if (!isActive) {
          return;
        }

        notificationsReadyRef.current = Boolean(granted);
      } catch (error) {
        console.warn('[Telemetry] notification setup failed', error);
      }
    };

    configureNotifications();

    return () => {
      isActive = false;
    };
  }, []);

  const registerCriticalAlerts = useCallback((criticalAlerts) => {
    if (!criticalAlerts?.length) {
      return [];
    }

    const now = Date.now();
    const triggered = [];

    criticalAlerts.forEach((alert) => {
      const key = `${alert.title}|${alert.value}`;
      const lastTriggeredAt = alertHistoryRef.current.get(key) ?? 0;
      if (now - lastTriggeredAt >= NOTIFICATION_COOLDOWN_MS) {
        alertHistoryRef.current.set(key, now);
        triggered.push(alert);
      }
    });

    if (alertHistoryRef.current.size > ALERT_HISTORY_LIMIT) {
      const sortedEntries = [...alertHistoryRef.current.entries()].sort((a, b) => a[1] - b[1]);
      while (sortedEntries.length > ALERT_HISTORY_LIMIT) {
        const [staleKey] = sortedEntries.shift() ?? [];
        if (staleKey) {
          alertHistoryRef.current.delete(staleKey);
        }
      }
    }

    return triggered;
  }, []);

  const deliverCriticalNotifications = useCallback(async (alertsToNotify) => {
    if (!alertsToNotify?.length) {
      return;
    }

    try {
      Vibration.vibrate(VIBRATION_PATTERN);

      const messageBody = alertsToNotify.map((alert) => `• ${alert.title}`).join('\n');

      if (!notificationsReadyRef.current) {
        Alert.alert('Shelvy Alert', messageBody);
        return;
      }

      await Promise.all(
        alertsToNotify.map((alert) =>
          Notifications.scheduleNotificationAsync({
            content: {
              title: 'Shelvy Alert',
              body: alert.title,
              sound: 'default',
              data: {
                severity: alert.severity,
                value: alert.value,
                deviceId: alert.deviceId,
              },
            },
            trigger: null,
          })
        )
      );
    } catch (error) {
      console.warn('[Telemetry] failed to schedule critical alert notification', error);
    }
  }, []);

  const refreshTelemetry = useCallback(async () => {
    if (!token || !isMountedRef.current) {
      return;
    }

    setStatus((prev) => ({ ...prev, isLoading: true }));

    try {
      const reading = await fetchLatestReading(token);
      if (!reading) {
        throw new Error('No sensor data available.');
      }

      const temperature = Number(reading.temperature ?? NaN);
      const humidity = Number(reading.humidity ?? NaN);
      if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
        throw new Error('Received invalid sensor values.');
      }

      const capturedAt = reading.capturedAt ? new Date(reading.capturedAt) : new Date();
      const isoCapturedAt = capturedAt.toISOString();

      let alertsPayload;
      try {
        alertsPayload = await fetchReadingAlerts(token);
      } catch (alertsError) {
        console.warn('[Telemetry] failed to fetch alerts', alertsError);
      }

      if (!isMountedRef.current || activeTokenRef.current !== token) {
        return;
      }

      const alerts = Array.isArray(alertsPayload?.alerts)
        ? alertsPayload.alerts.map((message, index) => ({
            id: `alert-${Date.now()}-${index}`,
            deviceId: CASING_DEVICE_ID,
            title: message,
            severity: /high|critical/i.test(message) ? CRITICAL_SEVERITY : 'info',
            timestamp: isoCapturedAt,
            value: `${humidity.toFixed(1)}% · ${temperature.toFixed(1)}°C`,
          }))
        : null;

      const triggeredCriticalAlerts = registerCriticalAlerts(
        alerts?.filter((alert) => alert.severity === CRITICAL_SEVERITY) ?? []
      );

      if (triggeredCriticalAlerts.length) {
        await deliverCriticalNotifications(triggeredCriticalAlerts);
      }

      const alertLogEntries = triggeredCriticalAlerts.map((alert, index) => ({
        id: `log-alert-${Date.now()}-${index}`,
        timestamp: isoCapturedAt,
        deviceId: alert.deviceId,
        event: alert.title,
        type: 'alert',
      }));

      setState((prev) => {
        const activeDeviceId = prev.activeDeviceId ?? CASING_DEVICE_ID;
        const isCasingActive = activeDeviceId === CASING_DEVICE_ID;

        const previousTemp =
          typeof prev.summary.temperature === 'number' ? prev.summary.temperature : temperature;
        const previousHumidity =
          typeof prev.summary.humidity === 'number' ? prev.summary.humidity : humidity;

        const baseDevice =
          prev.devices.find((device) => device.id === CASING_DEVICE_ID) ?? {
            id: CASING_DEVICE_ID,
            name: 'Casing 1',
            location: 'Bakery Floor · Section A',
            status: 'online',
            isActive: true,
            lastUpdated: isoCapturedAt,
          };

        const updatedCasing = {
          ...baseDevice,
          temperature,
          humidity,
          status: 'online',
          isActive: isCasingActive,
          lastUpdated: isoCapturedAt,
        };

        const otherDevices = prev.devices
          .filter((device) => device.id !== CASING_DEVICE_ID)
          .map((device) => ({
            ...device,
            isActive: device.id === activeDeviceId,
          }));

        const historyEntry = {
          id: `reading-${Date.now()}`,
          deviceId: CASING_DEVICE_ID,
          temperature,
          humidity,
          timestamp: isoCapturedAt,
        };

        const logEntry = {
          id: `log-${Date.now()}`,
          timestamp: isoCapturedAt,
          deviceId: CASING_DEVICE_ID,
          event: `Reading ${temperature.toFixed(1)}°C / ${humidity.toFixed(1)}%`,
          type: 'metric',
        };

        const summary = isCasingActive
          ? {
              temperature,
              humidity,
              temperatureTrend: Number((temperature - previousTemp).toFixed(2)),
              humidityTrend: Number((humidity - previousHumidity).toFixed(2)),
              lastUpdated: isoCapturedAt,
              deviceId: CASING_DEVICE_ID,
            }
          : prev.summary;

        return {
          ...prev,
          summary,
          devices: [updatedCasing, ...otherDevices],
          history: [historyEntry, ...prev.history].slice(0, HISTORY_LIMIT),
          logs: [...alertLogEntries, logEntry, ...prev.logs].slice(0, LOG_LIMIT),
          alerts: alerts ?? prev.alerts,
          activeDeviceId,
          lastUpdated: isoCapturedAt,
        };
      });

      if (!isMountedRef.current || activeTokenRef.current !== token) {
        return;
      }

      setStatus((prev) => ({
        ...prev,
        isLive: true,
        isLoading: false,
        error: null,
        lastSyncedAt: isoCapturedAt,
      }));
    } catch (error) {
      if (!isMountedRef.current || activeTokenRef.current !== token) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Unable to fetch readings.';
      console.warn('[Telemetry] refresh failed', error);
      setStatus((prev) => ({
        ...prev,
        isLive: false,
        isLoading: false,
        error: message,
      }));
    }
  }, [token, deliverCriticalNotifications, registerCriticalAlerts]);

  useEffect(() => {
    if (!token) {
      setState(createInitialState());
      setStatus(INITIAL_STATUS);
      return;
    }

    let isCancelled = false;
    let timerId;

    const tick = async () => {
      await refreshTelemetry();
      if (!isCancelled) {
        timerId = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    tick();

    return () => {
      isCancelled = true;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [token, refreshTelemetry]);

  const setActiveDevice = useCallback((deviceId) => {
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
          deviceId,
        },
      };
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      ...state,
      status,
      setActiveDevice,
      refreshTelemetry,
    }),
    [state, status, refreshTelemetry, setActiveDevice]
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
