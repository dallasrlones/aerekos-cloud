import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../styles/theme';
import { ModalStyles } from './Modal.styles';

export const ModalComponent = ({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  contentStyle,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={ModalStyles.overlay}
      >
        <TouchableOpacity
          style={ModalStyles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={ModalStyles.container}
          >
            <View style={ModalStyles.header}>
              <Text style={ModalStyles.title}>{title}</Text>
              {showCloseButton && (
                <TouchableOpacity
                  onPress={onClose}
                  style={ModalStyles.closeButton}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              style={ModalStyles.content}
              contentContainerStyle={[ModalStyles.contentContainer, contentStyle]}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};
