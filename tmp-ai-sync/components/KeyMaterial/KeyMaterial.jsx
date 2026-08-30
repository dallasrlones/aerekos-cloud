import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { KeyMaterialStyles } from './KeyMaterial.styles';

export const KeyMaterial = ({ keyMaterial, onCopy }) => {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Auto-hide after 30 seconds
    if (visible) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleCopy = () => {
    if (onCopy) {
      onCopy(keyMaterial);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskedMaterial = '•'.repeat(Math.min(keyMaterial?.length || 0, 64));

  return (
    <View style={KeyMaterialStyles.container}>
      <View style={KeyMaterialStyles.header}>
        <Text style={KeyMaterialStyles.label}>Key Material</Text>
        <View style={KeyMaterialStyles.actions}>
          <TouchableOpacity
            onPress={() => setVisible(!visible)}
            style={KeyMaterialStyles.eyeButton}
          >
            <Text style={KeyMaterialStyles.eyeText}>
              {visible ? '👁️ Hide' : '👁️‍🗨️ Show'}
            </Text>
          </TouchableOpacity>
          {visible && (
            <TouchableOpacity
              onPress={handleCopy}
              style={KeyMaterialStyles.copyButton}
            >
              <Text style={KeyMaterialStyles.copyText}>
                {copied ? '✓ Copied' : '📋 Copy'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <View style={KeyMaterialStyles.materialContainer}>
        <TextInput
          style={KeyMaterialStyles.materialText}
          value={visible ? keyMaterial : maskedMaterial}
          editable={false}
          multiline
          selectTextOnFocus={visible}
        />
      </View>

      {visible && (
        <View style={KeyMaterialStyles.warning}>
          <Text style={KeyMaterialStyles.warningText}>
            ⚠️ Warning: Key material is sensitive. Keep it secure and never share it.
          </Text>
        </View>
      )}
    </View>
  );
};
