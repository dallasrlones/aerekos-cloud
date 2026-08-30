import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { colors, spacing } from '../../styles/theme';

const ToastContext = createContext({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, opts = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast = {
      id,
      message: String(message || ''),
      kind: opts.kind || 'info',
    };
    setToasts((prev) => [toast, ...prev].slice(0, 5));
    const ms = opts.durationMs == null ? 4000 : opts.durationMs;
    if (ms > 0) setTimeout(() => dismiss(id), ms);
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View style={styles.stack}>
        {toasts.map((t) => (
          <TouchableOpacity key={t.id} style={[styles.toast, t.kind === 'error' && styles.error]} onPress={() => dismiss(t.id)}>
            <Text style={styles.text}>{t.message}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  stack: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    zIndex: 9999,
    gap: 8,
    maxWidth: 360,
    pointerEvents: 'box-none',
  },
  toast: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  error: { borderColor: '#c62828' },
  text: { color: colors.textPrimary, fontSize: 13 },
});
