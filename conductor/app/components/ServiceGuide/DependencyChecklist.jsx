import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../Button/Button';
import { StatusPill } from '../ui/StatusPill';
import { getServiceLabel } from '../../services/serviceCatalog';

/**
 * @param {{ deps: { id: string, name?: string, status: string, why?: string }[], onSetup?: (dep) => void, onEnableAll?: () => void }} props
 */
export const DependencyChecklist = ({ deps = [], onSetup, onEnableAll }) => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const missing = deps.filter((d) => d.status !== 'satisfied' && d.status !== 'ready' && d.status !== 'connected');

  if (!deps.length) {
    return (
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
        No platform dependencies required.
      </Text>
    );
  }

  return (
    <View>
      {deps.map((dep) => {
        const ready = dep.status === 'satisfied' || dep.status === 'ready' || dep.status === 'connected';
        const label = dep.name || getServiceLabel(dep.id);
        return (
          <View
            key={dep.id}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: spacing.sm,
              paddingVertical: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.divider,
            }}
          >
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
                <Text style={{ ...typography.body, color: colors.textPrimary, fontWeight: '600' }}>
                  {label}
                </Text>
                <StatusPill
                  status={ready ? 'healthy' : 'pending'}
                  label={ready ? 'Ready' : 'Missing'}
                />
              </View>
              {dep.why ? (
                <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
                  {dep.why}
                </Text>
              ) : null}
            </View>
            {!ready && onSetup ? (
              <Button
                title="Set up"
                variant="secondary"
                onPress={() => onSetup(dep)}
                style={{ paddingVertical: spacing.sm, minHeight: 40, minWidth: 88 }}
              />
            ) : null}
          </View>
        );
      })}

      {missing.length > 0 && onEnableAll ? (
        <View
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.divider,
          }}
        >
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>
            {missing.length} dependency{missing.length === 1 ? '' : 'ies'} still need to be enabled for this project.
          </Text>
          <Button title="Enable automatically" onPress={onEnableAll} />
        </View>
      ) : null}
    </View>
  );
};

export default DependencyChecklist;
