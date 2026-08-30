import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalComponent } from '../Modal/Modal';
import { Input } from '../Input/Input';
import { Button } from '../Button/Button';
import { projectService } from '../../services/projectService';
import { colors, spacing } from '../../styles/theme';
import { AddWorkerModalStyles } from './AddWorkerModal.styles';

export const AddWorkerModal = ({ visible, onClose, projectId, onWorkerAdded }) => {
  const [workers, setWorkers] = useState([]);
  const [filteredWorkers, setFilteredWorkers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      loadWorkers();
      setSearchQuery('');
      setSelectedWorkers([]);
      setError(null);
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredWorkers(workers);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredWorkers(
        workers.filter(worker =>
          worker.hostname.toLowerCase().includes(query) ||
          worker.ip_address.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, workers]);

  const loadWorkers = async () => {
    setLoading(true);
    try {
      const result = await projectService.getAllWorkers();
      if (result.success) {
        setWorkers(result.workers);
        setFilteredWorkers(result.workers);
      } else {
        setError(result.error || 'Failed to load workers');
      }
    } catch (error) {
      setError(error.message || 'Failed to load workers');
    } finally {
      setLoading(false);
    }
  };

  const toggleWorker = (workerId) => {
    if (selectedWorkers.includes(workerId)) {
      setSelectedWorkers(selectedWorkers.filter(id => id !== workerId));
    } else {
      setSelectedWorkers([...selectedWorkers, workerId]);
    }
  };

  const handleAddWorkers = async () => {
    if (selectedWorkers.length === 0) {
      Alert.alert('No Workers Selected', 'Please select at least one worker to add.');
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const results = await Promise.all(
        selectedWorkers.map(workerId =>
          projectService.assignWorker(projectId, workerId)
        )
      );

      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        setError(`Failed to add ${failed.length} worker(s). ${failed[0].error}`);
      } else {
        Alert.alert('Success', `Successfully added ${selectedWorkers.length} worker(s) to project.`);
        onWorkerAdded();
        onClose();
      }
    } catch (error) {
      setError(error.message || 'Failed to add workers');
    } finally {
      setAdding(false);
    }
  };

  return (
    <ModalComponent
      visible={visible}
      onClose={onClose}
      title="Add Workers to Project"
    >
      <View style={AddWorkerModalStyles.container}>
        {error && (
          <View style={AddWorkerModalStyles.errorContainer}>
            <Text style={AddWorkerModalStyles.errorText}>{error}</Text>
          </View>
        )}

        <Input
          label="Search Workers"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by hostname or IP address..."
          style={AddWorkerModalStyles.searchInput}
        />

        {selectedWorkers.length > 0 && (
          <View style={AddWorkerModalStyles.selectedContainer}>
            <Text style={AddWorkerModalStyles.selectedText}>
              {selectedWorkers.length} worker{selectedWorkers.length > 1 ? 's' : ''} selected
            </Text>
          </View>
        )}

        {loading ? (
          <View style={AddWorkerModalStyles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={AddWorkerModalStyles.loadingText}>Loading workers...</Text>
          </View>
        ) : filteredWorkers.length === 0 ? (
          <View style={AddWorkerModalStyles.emptyContainer}>
            <Text style={AddWorkerModalStyles.emptyText}>
              {searchQuery ? 'No workers found matching your search' : 'No workers available'}
            </Text>
          </View>
        ) : (
          <View style={AddWorkerModalStyles.workersList}>
            {filteredWorkers.map((worker) => {
              const isSelected = selectedWorkers.includes(worker.id);
              return (
                <TouchableOpacity
                  key={worker.id}
                  style={[
                    AddWorkerModalStyles.workerItem,
                    isSelected && AddWorkerModalStyles.workerItemSelected
                  ]}
                  onPress={() => toggleWorker(worker.id)}
                >
                  <View style={AddWorkerModalStyles.workerItemContent}>
                    <Text style={AddWorkerModalStyles.workerHostname}>{worker.hostname}</Text>
                    <Text style={AddWorkerModalStyles.workerIP}>{worker.ip_address}</Text>
                    <View style={AddWorkerModalStyles.workerStatus}>
                      <View style={[
                        AddWorkerModalStyles.statusDot,
                        worker.status === 'online' ? AddWorkerModalStyles.statusDotOnline : AddWorkerModalStyles.statusDotOffline
                      ]} />
                      <Text style={AddWorkerModalStyles.statusText}>{worker.status}</Text>
                    </View>
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

        <View style={AddWorkerModalStyles.actions}>
          <Button
            title="Cancel"
            onPress={onClose}
            variant="secondary"
            disabled={adding}
            style={AddWorkerModalStyles.button}
          />
          <Button
            title={adding ? 'Adding...' : `Add ${selectedWorkers.length || ''} Worker${selectedWorkers.length !== 1 ? 's' : ''}`}
            onPress={handleAddWorkers}
            variant="primary"
            loading={adding}
            disabled={adding || selectedWorkers.length === 0}
            style={AddWorkerModalStyles.button}
          />
        </View>
      </View>
    </ModalComponent>
  );
};
