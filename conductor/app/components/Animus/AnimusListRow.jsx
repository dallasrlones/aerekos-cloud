import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

export const AnimusListRow = ({
  title,
  meta,
  status,
  statusColor,
  icon = 'ellipse-outline',
  onPress,
  style,
}) => {
  const { colors, animus } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
          backgroundColor: pressed || hovered ? animus.goldFaint : 'transparent',
          ...(Platform.OS === 'web' ? { cursor: onPress ? 'pointer' : 'default' } : {}),
        },
        pressed ? { transform: [{ scale: 0.995 }] } : null,
        style,
      ]}
    >
      <Ionicons name={icon} size={20} color={animus.gold} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{
          fontSize: 15,
          color: colors.textPrimary,
          fontWeight: '500',
        }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {meta ? (
          <Text style={{
            fontSize: 12,
            color: colors.textMuted,
            fontFamily: animus.mono,
            marginTop: 2,
          }}
            numberOfLines={1}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      {status ? (
        <View style={{
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: statusColor || animus.goldSoft,
          backgroundColor: animus.goldFaint,
        }}
        >
          <Text style={{
            fontSize: 10,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: statusColor || animus.gold,
            fontFamily: animus.mono,
            fontWeight: '700',
          }}
          >
            {status}
          </Text>
        </View>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </Pressable>
  );
};

export default AnimusListRow;
