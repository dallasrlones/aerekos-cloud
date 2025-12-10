import React from 'react';
import { View, Text } from 'react-native';
import { BoxStyles } from './Box.styles';

export const Box = ({ title, children, style }) => {
  return (
    <View style={[BoxStyles.container, style]}>
      {title && (
        <Text style={BoxStyles.title}>{title}</Text>
      )}
      {children}
    </View>
  );
};

