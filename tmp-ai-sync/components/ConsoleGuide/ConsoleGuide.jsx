import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';
import { ConsoleGuideStyles as S } from './ConsoleGuide.styles';

/**
 * AWS-style numbered getting-started / tutorial steps.
 */
export const ConsoleGuide = ({ title, steps = [], defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  if (!steps.length) return null;

  return (
    <View style={S.wrap}>
      <TouchableOpacity style={S.header} onPress={() => setOpen((v) => !v)} activeOpacity={0.7}>
        <Ionicons name="book-outline" size={18} color={colors.primary} />
        <Text style={S.headerTitle}>{title || 'Getting started'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={S.body}>
          {steps.map((step, i) => (
            <View key={i} style={S.step}>
              <View style={S.badge}><Text style={S.badgeText}>{i + 1}</Text></View>
              <View style={S.stepContent}>
                <Text style={S.stepTitle}>{step.title}</Text>
                <Text style={S.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};
