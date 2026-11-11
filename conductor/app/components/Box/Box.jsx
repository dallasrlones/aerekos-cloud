import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export const Box = ({ title, children, style }) => {
  const { colors, spacing, typography, shadows } = useTheme();
  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.cardBackground,
      borderRadius: 0,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadows.small,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    title: {
      ...typography.h3,
      marginBottom: spacing.md,
      color: colors.textPrimary,
      textTransform: 'uppercase',
      letterSpacing: 2,
      fontWeight: '300',
    },
  });

  return (
    <View style={[styles.container, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
};
