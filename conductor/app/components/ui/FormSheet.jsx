import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export const FormSheet = ({ visible, title, onClose, children, footer }) => {
  const { colors, spacing, borderRadius, typography, mode } = useTheme();
  const { compact } = useBreakpoint();
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e?.stopPropagation?.()}
          style={{
            backgroundColor: colors.background,
            padding: spacing.lg,
            width: '100%',
            maxHeight: '92%',
            ...(compact
              ? { borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl }
              : {
                maxWidth: 520,
                borderRadius: borderRadius.xl,
                marginBottom: 48,
                ...(Platform.OS === 'web' ? {
                  boxShadow: mode === 'dark'
                    ? '0 8px 32px rgba(0,0,0,0.55)'
                    : '0 8px 32px rgba(0,0,0,0.18)',
                } : {}),
              }),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={{ ...typography.h3, flex: 1, color: colors.textPrimary }}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingTop: spacing.md, gap: spacing.sm }}>{footer}</View> : null}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};
