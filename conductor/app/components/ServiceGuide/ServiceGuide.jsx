import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AnimusSection } from '../Animus/AnimusSection';
import { Button } from '../Button/Button';
import { DependencyChecklist } from './DependencyChecklist';

/**
 * AWS-console-style overview: product blurb, when to use, prerequisites, examples.
 *
 * @param {{
 *   title: string,
 *   analogue?: string,
 *   blurb?: string,
 *   whenToUse?: string[],
 *   prerequisites?: string[],
 *   examples?: { label: string, code: string }[],
 *   onSetup?: () => void,
 *   deps?: { id: string, name?: string, status: string, why?: string }[],
 *   onSetupDep?: (dep) => void,
 *   onEnableAllDeps?: () => void,
 *   children?: React.ReactNode,
 * }} props
 */
export const ServiceGuide = ({
  title,
  analogue,
  blurb,
  whenToUse = [],
  prerequisites = [],
  examples = [],
  onSetup,
  deps,
  onSetupDep,
  onEnableAllDeps,
  children,
}) => {
  const { colors, spacing, typography, animus, borderRadius } = useTheme();

  const bullet = (items, sectionTitle) => {
    if (!items?.length) return null;
    return (
      <AnimusSection title={sectionTitle} brackets={false}>
        {items.map((line) => (
          <View key={line} style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Text style={{ color: animus.gold, marginRight: 8 }}>•</Text>
            <Text style={{ flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
              {line}
            </Text>
          </View>
        ))}
      </AnimusSection>
    );
  };

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <AnimusSection
        title={title}
        hint={blurb}
        right={onSetup ? <Button title="Set up" onPress={onSetup} style={{ paddingVertical: 8, minHeight: 36 }} /> : null}
      >
        {analogue ? (
          <Text
            style={{
              fontSize: 12,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: colors.textMuted,
              marginBottom: spacing.sm,
            }}
          >
            Like {analogue}
          </Text>
        ) : null}
      </AnimusSection>

      {deps?.length ? (
        <AnimusSection title="Dependencies" hint="Required managers must be enabled for your project before this service is production-ready.">
          <DependencyChecklist deps={deps} onSetup={onSetupDep} onEnableAll={onEnableAllDeps} />
        </AnimusSection>
      ) : null}

      {bullet(whenToUse, 'When to use')}
      {bullet(prerequisites, 'Prerequisites')}

      {examples?.length ? (
        <AnimusSection title="Examples" brackets={false}>
          {examples.map((ex) => (
            <View key={ex.label} style={{ marginBottom: spacing.md }}>
              <Text style={{ ...typography.body, color: colors.textPrimary, marginBottom: 6, fontWeight: '600' }}>
                {ex.label}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.divider,
                }}
              >
                <Text
                  selectable
                  style={{
                    fontFamily: animus.mono,
                    fontSize: 12,
                    color: colors.textSecondary,
                    padding: spacing.md,
                  }}
                >
                  {ex.code}
                </Text>
              </ScrollView>
            </View>
          ))}
        </AnimusSection>
      ) : null}

      {children}
    </View>
  );
};

export default ServiceGuide;
