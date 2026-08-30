import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Alert } from 'react-native';
import { KeyCard } from '../../components/KeyCard/KeyCard';
import { keyManagerService } from '../../services/keyManagerService';
import { useProject } from '../../contexts/ProjectContext';
import { KeysListStyles } from './KeysList.styles';

export const KeysList = ({ navigation }) => {
  const { currentProject } = useProject();
  const [keys, setKeys] = useState([]);
  const [filteredKeys, setFilteredKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterActive, setFilterActive] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentProject?.id) {
      loadKeys();
    } else {
      setError('No project selected. Please select a project first.');
      setLoading(false);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    filterKeys();
  }, [keys, searchQuery, filterType, filterActive]);

  const loadKeys = async () => {
    if (!currentProject?.id) {
      setError('No project selected');
      return;
    }

    try {
      setLoading(true);
      const filters = {};
      if (filterActive !== 'all') {
        filters.active = filterActive === 'active';
      }
      if (filterType !== 'all') {
        filters.type = filterType;
      }
      
      const response = await keyManagerService.getKeys(currentProject.id, filters);
      setKeys(response.keys || []);
      setError(null);
    } catch (err) {
      console.error('Error loading keys:', err);
      setError(err.message || 'Failed to load keys');
    } finally {
      setLoading(false);
    }
  };

  const filterKeys = () => {
    let filtered = [...keys];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(key =>
        key.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredKeys(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadKeys();
    setRefreshing(false);
  };

  const handleKeyPress = (keyName) => {
    navigation.navigate('keyDetails', { keyName });
  };

  const handleRotate = async (keyName) => {
    if (!currentProject?.id) {
      Alert.alert('Error', 'No project selected');
      return;
    }
    try {
      await keyManagerService.rotateKey(currentProject.id, keyName);
      await loadKeys();
    } catch (err) {
      console.error('Error rotating key:', err);
      alert(`Failed to rotate key: ${err.message}`);
    }
  };

  const handleArchive = async (keyName) => {
    if (!currentProject?.id) {
      Alert.alert('Error', 'No project selected');
      return;
    }
    try {
      await keyManagerService.archiveKey(currentProject.id, keyName);
      await loadKeys();
    } catch (err) {
      console.error('Error archiving key:', err);
      alert(`Failed to archive key: ${err.message}`);
    }
  };

  // Removed delete functionality - keys should only be archived, never deleted

  return (
    <View style={KeysListStyles.container}>
      {/* Header */}
      <View style={KeysListStyles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={KeysListStyles.backButton}
        >
          <Text style={KeysListStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={KeysListStyles.title}>Keys</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('createKey')}
          style={KeysListStyles.createButton}
        >
          <Text style={KeysListStyles.createButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={KeysListStyles.filters}>
        <TextInput
          style={KeysListStyles.searchInput}
          placeholder="Search keys..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        
        <View style={KeysListStyles.filterRow}>
          <TouchableOpacity
            style={[
              KeysListStyles.filterButton,
              filterType === 'all' && KeysListStyles.filterButtonActive
            ]}
            onPress={() => setFilterType('all')}
          >
            <Text style={[
              KeysListStyles.filterButtonText,
              filterType === 'all' && KeysListStyles.filterButtonTextActive
            ]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              KeysListStyles.filterButton,
              filterType === 'symmetric' && KeysListStyles.filterButtonActive
            ]}
            onPress={() => setFilterType('symmetric')}
          >
            <Text style={[
              KeysListStyles.filterButtonText,
              filterType === 'symmetric' && KeysListStyles.filterButtonTextActive
            ]}>Symmetric</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              KeysListStyles.filterButton,
              filterType === 'asymmetric' && KeysListStyles.filterButtonActive
            ]}
            onPress={() => setFilterType('asymmetric')}
          >
            <Text style={[
              KeysListStyles.filterButtonText,
              filterType === 'asymmetric' && KeysListStyles.filterButtonTextActive
            ]}>Asymmetric</Text>
          </TouchableOpacity>
        </View>

        <View style={KeysListStyles.filterRow}>
          <TouchableOpacity
            style={[
              KeysListStyles.filterButton,
              filterActive === 'all' && KeysListStyles.filterButtonActive
            ]}
            onPress={() => setFilterActive('all')}
          >
            <Text style={[
              KeysListStyles.filterButtonText,
              filterActive === 'all' && KeysListStyles.filterButtonTextActive
            ]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              KeysListStyles.filterButton,
              filterActive === 'active' && KeysListStyles.filterButtonActive
            ]}
            onPress={() => setFilterActive('active')}
          >
            <Text style={[
              KeysListStyles.filterButtonText,
              filterActive === 'active' && KeysListStyles.filterButtonTextActive
            ]}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              KeysListStyles.filterButton,
              filterActive === 'archived' && KeysListStyles.filterButtonActive
            ]}
            onPress={() => setFilterActive('archived')}
          >
            <Text style={[
              KeysListStyles.filterButtonText,
              filterActive === 'archived' && KeysListStyles.filterButtonTextActive
            ]}>Archived</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Keys List */}
      <ScrollView
        style={KeysListStyles.list}
        contentContainerStyle={KeysListStyles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <Text style={KeysListStyles.loadingText}>Loading keys...</Text>
        ) : error ? (
          <Text style={KeysListStyles.errorText}>{error}</Text>
        ) : filteredKeys.length === 0 ? (
          <View style={KeysListStyles.emptyState}>
            <Text style={KeysListStyles.emptyStateText}>No keys found</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('createKey')}
              style={KeysListStyles.emptyStateButton}
            >
              <Text style={KeysListStyles.emptyStateButtonText}>Create Your First Key</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredKeys.map((keyData) => (
            <KeyCard
              key={keyData.id}
              keyData={keyData}
              onPress={() => handleKeyPress(keyData.name)}
              onRotate={handleRotate}
              onArchive={handleArchive}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};
