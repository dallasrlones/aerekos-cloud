import { StyleSheet } from 'react-native';
import { colors, spacing, typography, shadows } from '../../styles/theme';

export const BoxStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
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

