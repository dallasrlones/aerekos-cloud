import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalComponent } from '../Modal/Modal';
import { Input } from '../Input/Input';
import { Button } from '../Button/Button';
import { projectService } from '../../services/projectService';
import { colors, spacing } from '../../styles/theme';
import { AddServiceModalStyles } from './AddServiceModal.styles';

export const AddServiceModal = ({ visible, onClose, projectId, onServiceAdded }) => {
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      loadServices();
      setSearchQuery('');
      setSelectedServices([]);
      setError(null);
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredServices(services);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredServices(
        services.filter(service =>
          service.name.toLowerCase().includes(query) ||
          (service.docker_image && service.docker_image.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, services]);

  const loadServices = async () => {
    setLoading(true);
    try {
      const result = await projectService.getAllServices();
      if (result.success) {
        setServices(result.services);
        setFilteredServices(result.services);
      } else {
        setError(result.error || 'Failed to load services');
      }
    } catch (error) {
      setError(error.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (serviceId) => {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter(id => id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, serviceId]);
    }
  };

  const handleAddServices = async () => {
    if (selectedServices.length === 0) {
      Alert.alert('No Services Selected', 'Please select at least one service to add.');
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const results = await Promise.all(
        selectedServices.map(serviceId =>
          projectService.assignService(projectId, serviceId)
        )
      );

      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        setError(`Failed to add ${failed.length} service(s). ${failed[0].error}`);
      } else {
        Alert.alert('Success', `Successfully added ${selectedServices.length} service(s) to project.`);
        onServiceAdded();
        onClose();
      }
    } catch (error) {
      setError(error.message || 'Failed to add services');
    } finally {
      setAdding(false);
    }
  };

  return (
    <ModalComponent
      visible={visible}
      onClose={onClose}
      title="Add Services to Project"
    >
      <View style={AddServiceModalStyles.container}>
        {error && (
          <View style={AddServiceModalStyles.errorContainer}>
            <Text style={AddServiceModalStyles.errorText}>{error}</Text>
          </View>
        )}

        <Input
          label="Search Services"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name or docker image..."
          style={AddServiceModalStyles.searchInput}
        />

        {selectedServices.length > 0 && (
          <View style={AddServiceModalStyles.selectedContainer}>
            <Text style={AddServiceModalStyles.selectedText}>
              {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected
            </Text>
          </View>
        )}

        {loading ? (
          <View style={AddServiceModalStyles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={AddServiceModalStyles.loadingText}>Loading services...</Text>
          </View>
        ) : filteredServices.length === 0 ? (
          <View style={AddServiceModalStyles.emptyContainer}>
            <Text style={AddServiceModalStyles.emptyText}>
              {searchQuery ? 'No services found matching your search' : 'No services available'}
            </Text>
          </View>
        ) : (
          <View style={AddServiceModalStyles.servicesList}>
            {filteredServices.map((service) => {
              const isSelected = selectedServices.includes(service.id);
              return (
                <TouchableOpacity
                  key={service.id}
                  style={[
                    AddServiceModalStyles.serviceItem,
                    isSelected && AddServiceModalStyles.serviceItemSelected
                  ]}
                  onPress={() => toggleService(service.id)}
                >
                  <View style={AddServiceModalStyles.serviceItemContent}>
                    <Text style={AddServiceModalStyles.serviceName}>{service.name}</Text>
                    {service.docker_image && (
                      <Text style={AddServiceModalStyles.serviceImage}>{service.docker_image}</Text>
                    )}
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={24} color={colors.border} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={AddServiceModalStyles.actions}>
          <Button
            title="Cancel"
            onPress={onClose}
            variant="secondary"
            disabled={adding}
            style={AddServiceModalStyles.button}
          />
          <Button
            title={adding ? 'Adding...' : `Add ${selectedServices.length || ''} Service${selectedServices.length !== 1 ? 's' : ''}`}
            onPress={handleAddServices}
            variant="primary"
            loading={adding}
            disabled={adding || selectedServices.length === 0}
            style={AddServiceModalStyles.button}
          />
        </View>
      </View>
    </ModalComponent>
  );
};
