import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { ButtonStyles } from './Button.styles';

export const Button = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  disabled = false,
  loading = false,
  style,
  textStyle,
  inverted = false,
}) => {
  const invertedStyles = inverted ? {
    primary: ButtonStyles.primaryInverted,
    secondary: ButtonStyles.secondaryInverted,
    primaryText: ButtonStyles.primaryTextInverted,
    secondaryText: ButtonStyles.secondaryTextInverted,
  } : {};

  return (
    <TouchableOpacity
      style={[
        ButtonStyles.container,
        ButtonStyles[variant],
        inverted && invertedStyles[variant],
        disabled && ButtonStyles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator 
          color={inverted 
            ? (variant === 'primary' ? '#FFFFFF' : '#FFFFFF')
            : (variant === 'primary' ? '#000' : '#2C2C2C')
          } 
          size="small" 
        />
      ) : (
        <Text style={[
          ButtonStyles.text, 
          ButtonStyles[`${variant}Text`],
          inverted && invertedStyles[`${variant}Text`],
          textStyle
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};
