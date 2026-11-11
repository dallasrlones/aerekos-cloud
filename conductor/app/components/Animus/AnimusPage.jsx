import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, Animated, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AnimusBackground } from './AnimusBackground';
import { getMetaphor } from './metaphors';

/**
 * Full-bleed console shell: background + zone title + job one-liner + CTA slot.
 */
export const AnimusPage = ({
  title,
  job,
  metaphor = 'station',
  primaryAction = null,
  right = null,
  scroll = true,
  children,
  style,
}) => {
  const { colors, animus, spacing } = useTheme();
  const meta = getMetaphor(metaphor);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [opacity, translate]);

  const body = (
    <Animated.View style={{
      flex: 1,
      opacity,
      transform: [{ translateY: translate }],
      padding: spacing.md,
      paddingBottom: spacing.xxl,
      maxWidth: 1100,
      width: '100%',
      alignSelf: 'center',
    }}
    >
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: spacing.md,
        flexWrap: 'wrap',
      }}
      >
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={{
            fontSize: 10,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            color: animus.gold,
            fontFamily: animus.mono,
            marginBottom: 6,
          }}
          >
            {meta.zone}
          </Text>
          <Text style={{
            fontSize: 26,
            fontWeight: '300',
            letterSpacing: 1.5,
            color: colors.textPrimary,
          }}
          >
            {title}
          </Text>
          {job ? (
            <Text style={{
              marginTop: 6,
              fontSize: 14,
              color: colors.textSecondary,
              lineHeight: 20,
              maxWidth: 520,
            }}
            >
              {job}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {right}
          {primaryAction}
        </View>
      </View>
      {children}
    </Animated.View>
  );

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      <AnimusBackground />
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          {...(Platform.OS === 'web' ? { showsVerticalScrollIndicator: true } : {})}
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </View>
  );
};

export default AnimusPage;
