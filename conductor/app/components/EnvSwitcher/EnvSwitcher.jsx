import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../Button/Button';
import { useProject } from '../../contexts/ProjectContext';
import { useTheme } from '../../contexts/ThemeContext';

export const EnvSwitcher = ({ style, variant } = {}) => {
  const { currentEnvironment, environments, setCurrentEnvironment, isSystemProject } = useProject();
  const { colors, spacing, shadows, borderRadius } = useTheme();
  const [open, setOpen] = useState(false);

  if (isSystemProject) return null;

  const names = (environments || []).map((e) => e.name);
  const shown = names.length ? names : [currentEnvironment || 'dev'];
  if (shown.length <= 1) return null;

  const styles = {
    headerWrap: {
      minWidth: 72,
      maxWidth: 120,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginRight: spacing.xs,
      flexShrink: 1,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-start',
      paddingTop: Platform.select({ ios: 100, android: 80, web: 60 }),
      paddingHorizontal: spacing.md,
    },
    dropdown: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 320,
      ...shadows.large,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    itemActive: {
      backgroundColor: colors.surfaceHover,
    },
    itemText: {
      fontSize: 14,
      color: colors.textPrimary,
      flex: 1,
    },
    itemTextActive: {
      color: colors.accent,
      fontWeight: '600',
    },
  };

  if (variant === 'header') {
    return (
      <>
        <TouchableOpacity
          style={[styles.headerWrap, style]}
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerName} numberOfLines={1}>
              {currentEnvironment || shown[0]}
            </Text>
            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
            <View style={styles.dropdown}>
              <ScrollView>
                {shown.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={[styles.item, currentEnvironment === name && styles.itemActive]}
                    onPress={() => {
                      setOpen(false);
                      if (name !== currentEnvironment) setCurrentEnvironment(name);
                    }}
                  >
                    <Text style={[styles.itemText, currentEnvironment === name && styles.itemTextActive]}>
                      {name}
                    </Text>
                    {currentEnvironment === name ? (
                      <Ionicons name="checkmark" size={20} color={colors.accent} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }, style]}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>Environment</Text>
      {shown.map((name) => (
        <Button
          key={name}
          title={name}
          variant={currentEnvironment === name ? 'primary' : 'secondary'}
          onPress={() => setCurrentEnvironment(name)}
        />
      ))}
    </View>
  );
};
