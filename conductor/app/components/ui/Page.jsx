import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { AnimusBackground } from '../Animus/AnimusBackground';

export const Page = ({
  title,
  subtitle,
  children,
  refreshing,
  onRefresh,
  scroll = true,
  right,
}) => {
  const { colors, spacing, typography } = useTheme();
  const { compact } = useBreakpoint();
  const pad = compact ? spacing.md : spacing.lg;

  const inner = (
    <View style={{
      maxWidth: 960,
      width: '100%',
      alignSelf: 'center',
      padding: pad,
      paddingBottom: compact ? 96 : spacing.xxl,
    }}
    >
      {(title || subtitle || right) ? (
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
          gap: spacing.md,
        }}
        >
          <View style={{ flex: 1 }}>
            {title ? (
              <Text style={{ ...typography.h2, fontSize: 22, letterSpacing: 0.4, color: colors.textPrimary }}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={{ ...typography.caption, marginTop: 4, color: colors.textSecondary }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );

  const shell = (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AnimusBackground />
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh
              ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
              : undefined
          }
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </View>
  );

  return shell;
};

export const Card = ({ children, style }) => {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View style={[{
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    }, style]}
    >
      {children}
    </View>
  );
};
