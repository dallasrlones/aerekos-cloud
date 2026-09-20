import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../Button/Button';
import { useProject } from '../../contexts/ProjectContext';
import { colors } from '../../styles/theme';
import { EnvSwitcherStyles as HS } from './EnvSwitcher.styles';

export const EnvSwitcher = ({ style, variant } = {}) => {
  const { currentEnvironment, environments, setCurrentEnvironment, isSystemProject } = useProject();
  const [open, setOpen] = useState(false);

  if (isSystemProject) return null;

  const names = (environments || []).map((e) => e.name);
  const shown = names.length ? names : [currentEnvironment || 'dev'];
  if (shown.length <= 1) return null;

  if (variant === 'header') {
    return (
      <>
        <TouchableOpacity
          style={[HS.headerWrap, style]}
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
        >
          <View style={HS.headerContent}>
            <Text style={HS.headerName} numberOfLines={1}>
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
          <TouchableOpacity style={HS.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
            <View style={HS.dropdown}>
              <ScrollView>
                {shown.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={[HS.item, currentEnvironment === name && HS.itemActive]}
                    onPress={() => {
                      setOpen(false);
                      if (name !== currentEnvironment) setCurrentEnvironment(name);
                    }}
                  >
                    <Text style={[HS.itemText, currentEnvironment === name && HS.itemTextActive]}>
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
