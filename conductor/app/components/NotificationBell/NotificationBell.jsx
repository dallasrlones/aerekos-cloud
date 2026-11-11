import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useFleetAlerts } from '../FleetAlert/FleetAlertListener';
import { useJobs } from '../JobStatus/JobStatus';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export const NotificationBell = ({ navigation }) => {
  const { colors, spacing, borderRadius, typography, mode } = useTheme();
  const { downs, unread, markRead } = useFleetAlerts();
  const { jobs } = useJobs();
  const { compact } = useBreakpoint();
  const [open, setOpen] = useState(false);
  const fleetCount = downs.length || unread;
  const showDot = fleetCount === 0 && (jobs || []).length > 0;

  const styles = useMemo(() => StyleSheet.create({
    iconButton: {
      padding: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 44,
      minHeight: 44,
    },
    badge: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: colors.error,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    dot: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    panel: {
      position: 'absolute',
      right: 8,
      top: 48,
      width: 320,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      zIndex: 3000,
      ...(Platform.OS === 'web' ? {
        boxShadow: mode === 'dark'
          ? '0 8px 24px rgba(0,0,0,0.55)'
          : '0 8px 24px rgba(0,0,0,0.12)',
      } : {}),
    },
    panelFull: {
      position: 'relative',
      right: 0,
      top: 0,
      width: '100%',
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: '80%',
    },
    panelTitle: { ...typography.h3, marginBottom: spacing.sm, color: colors.textPrimary },
    section: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    empty: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
    row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
    rowText: { fontSize: 13, color: colors.textPrimary },
    kind: { fontSize: 11, color: colors.accent, textTransform: 'uppercase', marginBottom: 2 },
    closeBtn: { minHeight: 44, justifyContent: 'center', marginTop: spacing.sm },
    close: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  }), [colors, spacing, borderRadius, typography, mode]);

  const close = () => setOpen(false);
  const toggle = () => {
    setOpen((v) => !v);
    markRead();
  };

  const panel = (
    <View style={[styles.panel, compact && styles.panelFull]}>
      <Text style={styles.panelTitle}>Notifications</Text>
      <Text style={styles.section}>Fleet alerts</Text>
      {downs.length === 0 ? (
        <Text style={styles.empty}>All clear</Text>
      ) : (
        <ScrollView style={{ maxHeight: compact ? 220 : 180 }}>
          {downs.map((d) => (
            <TouchableOpacity
              key={d.key}
              style={styles.row}
              onPress={() => {
                close();
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
      <Text style={[styles.section, { marginTop: spacing.md }]}>Recent jobs</Text>
      {(jobs || []).length === 0 ? (
        <Text style={styles.empty}>No jobs yet</Text>
      ) : (jobs || []).slice(0, 8).map((j) => (
        <View key={j.id} style={styles.row}>
          <Text style={styles.kind}>{j.status}</Text>
          <Text style={styles.rowText} numberOfLines={2}>{j.summary || j.kind}</Text>
        </View>
      ))}
      <TouchableOpacity onPress={close} style={styles.closeBtn}>
        <Text style={styles.close}>Close</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View>
      <TouchableOpacity style={styles.iconButton} onPress={toggle} activeOpacity={0.7}>
        <Ionicons name="notifications-sharp" size={24} color={colors.textPrimary} />
        {fleetCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{String(fleetCount)}</Text>
          </View>
        ) : showDot ? (
          <View style={styles.dot} />
        ) : null}
      </TouchableOpacity>
      {open && compact ? (
        <Modal visible transparent animationType="fade" onRequestClose={close}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={close}>
            {panel}
          </TouchableOpacity>
        </Modal>
      ) : null}
      {open && !compact ? panel : null}
    </View>
  );
};
