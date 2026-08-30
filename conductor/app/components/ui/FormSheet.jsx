import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../styles/theme';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export const FormSheet = ({ visible, title, onClose, children, footer }) => {
  const { compact } = useBreakpoint();
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e?.stopPropagation?.()}
          style={[styles.sheet, compact ? styles.sheetFull : styles.sheetDesk]}
        >
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    width: '100%',
    maxHeight: '92%',
  },
  sheetFull: { borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl },
  sheetDesk: {
    maxWidth: 520,
    borderRadius: borderRadius.xl,
    marginBottom: 48,
    ...(Platform.OS === 'web' ? { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' } : {}),
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  title: { ...typography.h3, flex: 1 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingTop: spacing.md, gap: spacing.sm },
});
