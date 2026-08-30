import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import websocketService from '../../services/websocketService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast/ToastProvider';
import { colors, spacing } from '../../styles/theme';

const FleetAlertContext = createContext({
  downs: [],
  unread: 0,
  markRead: () => {},
  emitTest: () => {},
});

export const useFleetAlerts = () => useContext(FleetAlertContext);

function keyFor(kind, data) {
  if (kind.startsWith('worker')) return `worker:${data.workerId || data.hostname || 'unknown'}`;
  if (kind.startsWith('service')) return `service:${data.service || 'unknown'}:${data.workerId || ''}`;
  return `console`;
}

function labelFor(kind, data) {
  if (kind === 'worker:offline') return `Worker ${data.hostname || data.workerId || ''} offline`;
  if (kind === 'worker:online') return `Worker ${data.hostname || data.workerId || ''} online`;
  if (kind === 'service:unhealthy') return `${data.service} unhealthy`;
  if (kind === 'service:recovered') return `${data.service} recovered`;
  if (kind === 'service:degraded') return `${data.service} degraded`;
  if (kind === 'console:disconnected') return 'Console disconnected from conductor';
  if (kind === 'console:reconnected') return 'Console reconnected';
  return kind;
}

export const FleetAlertProvider = ({ children, navigation }) => {
  const { isAuthenticated, getToken } = useAuth();
  const { showToast } = useToast();
  const [downs, setDowns] = useState([]);
  const [unread, setUnread] = useState(0);
  const lastToast = useRef({});

  const record = useCallback((kind, data = {}) => {
    const key = keyFor(kind, data);
    const down = kind.includes('offline') || kind.includes('unhealthy') || kind.includes('degraded') || kind === 'console:disconnected';
    const up = kind.includes('online') || kind.includes('recovered') || kind === 'console:reconnected';
    const now = Date.now();
    const prev = lastToast.current[key] || 0;
    const debounce = 15000;
    const msg = labelFor(kind, data);
    if (now - prev > debounce) {
      showToast(msg, { kind: down ? 'error' : 'info', durationMs: 4000 });
      lastToast.current[key] = now;
    }
    setDowns((prevDowns) => {
      if (down) {
        const rest = prevDowns.filter((d) => d.key !== key);
        return [{ key, kind, message: msg, data, at: new Date().toISOString() }, ...rest];
      }
      if (up) return prevDowns.filter((d) => d.key !== key);
      return prevDowns;
    });
    if (down) setUnread((n) => n + 1);
  }, [showToast]);

  const emitTest = useCallback((payload) => {
    record('service:unhealthy', payload || { service: 'test_manager', workerId: 'test' });
  }, [record]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let unsubs = [];
    getToken().then((token) => {
      if (token) websocketService.connect(token);
    });
    const events = [
      'worker:offline', 'worker:online',
      'service:unhealthy', 'service:recovered', 'service:degraded',
      'console:disconnected', 'console:reconnected',
    ];
    unsubs = events.map((ev) => websocketService.on(ev, (data) => record(ev, data || {})));
    return () => { unsubs.forEach((u) => u && u()); };
  }, [isAuthenticated, getToken, record]);

  const value = useMemo(
    () => ({
      downs,
      unread,
      markRead: () => setUnread(0),
      emitTest,
      navigation,
    }),
    [downs, unread, emitTest, navigation],
  );

  return <FleetAlertContext.Provider value={value}>{children}</FleetAlertContext.Provider>;
};

export const FleetAlertBell = ({ navigation }) => {
  const { downs, unread, markRead } = useFleetAlerts();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        onPress={() => {
          setOpen((v) => !v);
          markRead();
        }}
        style={styles.bell}
        activeOpacity={0.7}
      >
        <Text style={styles.bellIcon}>🔔</Text>
        {unread > 0 || downs.length > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{String(downs.length || unread)}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      {open ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Fleet alerts</Text>
          {downs.length === 0 ? (
            <Text style={styles.empty}>All clear</Text>
          ) : (
            <ScrollView style={{ maxHeight: 240 }}>
              {downs.map((d) => (
                <TouchableOpacity
                  key={d.key}
                  style={styles.row}
                  onPress={() => {
                    setOpen(false);
                    if (d.kind.startsWith('worker')) navigation?.navigate('devices');
                    else if (d.data?.service) {
                      navigation?.navigate('managerConsole', { serviceName: d.data.service });
                    } else navigation?.navigate('devices');
                  }}
                >
                  <Text style={styles.rowText}>{d.message}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bell: { padding: spacing.sm, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  bellIcon: { fontSize: 18 },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#c62828',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  panel: {
    position: Platform.OS === 'web' ? 'absolute' : 'absolute',
    right: 0,
    top: 44,
    width: 280,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    zIndex: 2000,
  },
  panelTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  empty: { fontSize: 12, color: colors.textMuted },
  row: { paddingVertical: 6 },
  rowText: { fontSize: 12, color: colors.textPrimary },
});
