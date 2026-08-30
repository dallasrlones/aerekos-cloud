import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ProjectCardStyles } from './ProjectCard.styles';

export const ProjectCard = ({ projectData, onPress, onDelete }) => {
  if (!projectData) {
    return null; // Safety check - don't render if projectData is missing
  }
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <TouchableOpacity 
      style={ProjectCardStyles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={ProjectCardStyles.header}>
        <Text style={ProjectCardStyles.name}>{projectData.name}</Text>
        {onDelete && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onDelete(projectData.id, projectData.name);
            }}
            style={ProjectCardStyles.deleteButton}
          >
            <Text style={ProjectCardStyles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {projectData.description && (
        <Text style={ProjectCardStyles.description}>{projectData.description}</Text>
      )}
      
      <View style={ProjectCardStyles.details}>
        <View style={ProjectCardStyles.detailRow}>
          <Text style={ProjectCardStyles.label}>Created:</Text>
          <Text style={ProjectCardStyles.value}>{formatDate(projectData.created_at)}</Text>
        </View>
        {projectData.bucket_count !== undefined && (
          <View style={ProjectCardStyles.detailRow}>
            <Text style={ProjectCardStyles.label}>Buckets:</Text>
            <Text style={ProjectCardStyles.value}>{projectData.bucket_count || 0}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};
