import React from 'react';
import { TextInput, View, Text } from 'react-native';
import { InputStyles } from './Input.styles';

export const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  style,
  inverted = false,
  ...props
}) => {
  return (
    <View style={[InputStyles.container, style]}>
      {label && (
        <Text style={[
          InputStyles.label,
          inverted && InputStyles.labelInverted
        ]}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          InputStyles.input,
          error && InputStyles.inputError,
          inverted && InputStyles.inputInverted,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={inverted ? "#999" : "#666"}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
      {error && (
        <Text style={[
          InputStyles.errorText,
          inverted && InputStyles.errorTextInverted
        ]}>
          {error}
        </Text>
      )}
    </View>
  );
};
