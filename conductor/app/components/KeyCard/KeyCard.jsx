import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { KeyCardStyles } from './KeyCard.styles';

export const KeyCard = ({ keyData, onPress, onRotate, onArchive }) => {
  // Use keyData prop instead of 'key' to avoid conflict with React's special 'key' prop
  if (!keyData) {
    return null; // Safety check - don't render if keyData is missing
  }
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <TouchableOpacity 
      style={KeyCardStyles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={KeyCardStyles.header}>
        <Text style={KeyCardStyles.name}>{keyData.name}</Text>
        <View style={[
          KeyCardStyles.statusBadge,
          keyData.is_active ? KeyCardStyles.statusActive : KeyCardStyles.statusArchived
        ]}>
          <Text style={KeyCardStyles.statusText}>
            {keyData.is_active ? 'Active' : 'Archived'}
          </Text>
        </View>
      </View>
      
      <View style={KeyCardStyles.details}>
        <View style={KeyCardStyles.detailRow}>
          <Text style={KeyCardStyles.label}>Type:</Text>
          <Text style={KeyCardStyles.value}>{keyData.type}</Text>
        </View>
        <View style={KeyCardStyles.detailRow}>
          <Text style={KeyCardStyles.label}>Algorithm:</Text>
          <Text style={KeyCardStyles.value}>{keyData.algorithm}</Text>
        </View>
        <View style={KeyCardStyles.detailRow}>
          <Text style={KeyCardStyles.label}>Version:</Text>
          <Text style={KeyCardStyles.value}>v{keyData.key_version}</Text>
        </View>
        <View style={KeyCardStyles.detailRow}>
          <Text style={KeyCardStyles.label}>Created:</Text>
          <Text style={KeyCardStyles.value}>{formatDate(keyData.created_at)}</Text>
        </View>
      </View>

      {(onRotate || onArchive) && (
        <View style={KeyCardStyles.actions}>
          {onRotate && keyData.is_active && (
            <TouchableOpacity 
              style={[KeyCardStyles.actionButton, KeyCardStyles.rotateButton]}
              onPress={(e) => {
                e.stopPropagation();
                onRotate(keyData.name);
              }}
            >
              <Text style={KeyCardStyles.actionText}>Rotate</Text>
            </TouchableOpacity>
          )}
          {onArchive && keyData.is_active && (
            <TouchableOpacity 
              style={[KeyCardStyles.actionButton, KeyCardStyles.archiveButton]}
              onPress={(e) => {
                e.stopPropagation();
                onArchive(keyData.name);
              }}
            >
              <Text style={KeyCardStyles.actionText}>Archive</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};
