import { StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export const ProjectFormStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodySecondary,
    marginTop: spacing.md,
    color: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '300',
  },
  descriptionInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: colors.accent,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.background,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  cancelButton: {
    flex: 1,
    marginRight: spacing.md,
  },
  submitButton: {
    flex: 1,
  },
});
