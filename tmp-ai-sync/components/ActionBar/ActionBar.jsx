import React from 'react';
import { View, ScrollView } from 'react-native';
import { Button } from '../Button/Button';
import { ActionBarStyles as S } from './ActionBar.styles';

/**
 * AWS-style horizontal action row — primary ops visible without scrolling.
 */
export const ActionBar = ({ actions = [] }) => {
  if (!actions.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.scroll} contentContainerStyle={S.row}>
      {actions.map((a) => (
        <Button
          key={a.id || a.title}
          title={a.title}
          onPress={a.onPress}
          variant={a.variant || 'primary'}
          loading={a.loading}
          disabled={a.disabled}
          style={[S.btn, a.style]}
        />
      ))}
    </ScrollView>
  );
};
