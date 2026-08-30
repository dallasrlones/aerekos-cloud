import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export const ConsoleGuideStyles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  headerTitle: { ...typography.body, fontWeight: '600', flex: 1 },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  step: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepContent: { flex: 1 },
  stepTitle: { ...typography.body, fontWeight: '600', marginBottom: 2 },
  stepBody: { ...typography.bodySecondary, fontSize: 13, lineHeight: 19 },
});
