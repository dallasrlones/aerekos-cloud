import React from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export const Page = ({
  title,
  subtitle,
  children,
  refreshing,
  onRefresh,
  scroll = true,
  right,
}) => {
  const { compact } = useBreakpoint();
  const pad = compact ? spacing.md : spacing.lg;
  const inner = (
    <View style={[styles.inner, { padding: pad, paddingBottom: compact ? 96 : spacing.xxl }]}>
      {(title || subtitle || right) ? (
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
  if (!scroll) {
    return <View style={styles.wrap}>{inner}</View>;
  }
  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh
          ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
          : undefined
      }
    >
      {inner}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  inner: { maxWidth: 960, width: '100%', alignSelf: 'center' },
  hero: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg, gap: spacing.md },
  title: { ...typography.h2, fontSize: 22, letterSpacing: 0.4 },
  subtitle: { ...typography.caption, marginTop: 4 },
});

export const Card = ({ children, style }) => (
  <View style={[cardStyles.card, style]}>{children}</View>
);

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});
