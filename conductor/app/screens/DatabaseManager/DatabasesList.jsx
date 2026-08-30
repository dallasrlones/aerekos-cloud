import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dbManagerService } from '../../services/dbManagerService';
import { DatabasesListStyles } from './DatabasesList.styles';
import { colors } from '../../styles/theme';

export const DatabasesList = ({ navigation }) => {
  const [databases, setDatabases] = useState([]);
  const [filteredDatabases, setFilteredDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDatabases();
  }, []);

  useEffect(() => {
    filterDatabases();
  }, [databases, searchQuery, filterType, filterStatus]);

  const loadDatabases = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterStatus !== 'all') {
        filters.status = filterStatus;
      }
      if (filterType !== 'all') {
        filters.type = filterType;
      }
      
      const response = await dbManagerService.getDatabases(filters);
      setDatabases(response.databases || []);
      setError(null);
    } catch (err) {
      console.error('Error loading databases:', err);
      setError(err.message || 'Failed to load databases');
    } finally {
      setLoading(false);
    }
  };

  const filterDatabases = () => {
    let filtered = [...databases];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(db =>
        db.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        db.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredDatabases(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDatabases();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return '#4CAF50';
      case 'stopped': return '#FF9800';
      case 'creating': return '#2196F3';
      case 'failed': return '#F44336';
      default: return colors.textMuted;
    }
  };

  if (loading) {
    return (
      <View style={[DatabasesListStyles.container, DatabasesListStyles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={DatabasesListStyles.loadingText}>Loading databases...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={DatabasesListStyles.container}
      contentContainerStyle={DatabasesListStyles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={DatabasesListStyles.title}>All Databases</Text>

      {error && (
        <View style={DatabasesListStyles.errorBox}>
          <Text style={DatabasesListStyles.errorText}>{error}</Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={DatabasesListStyles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={DatabasesListStyles.searchInput}
          placeholder="Search databases..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={DatabasesListStyles.filtersContainer}>
        <Text style={DatabasesListStyles.filterLabel}>Type:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'postgresql', 'mongodb', 'redis', 'neo4j', 'elasticsearch'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                DatabasesListStyles.filterChip,
                filterType === type && DatabasesListStyles.filterChipActive
              ]}
              onPress={() => setFilterType(type)}
            >
              <Text style={[
                DatabasesListStyles.filterChipText,
                filterType === type && DatabasesListStyles.filterChipTextActive
              ]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={DatabasesListStyles.filtersContainer}>
        <Text style={DatabasesListStyles.filterLabel}>Status:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'running', 'stopped', 'creating', 'failed'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                DatabasesListStyles.filterChip,
                filterStatus === status && DatabasesListStyles.filterChipActive
              ]}
              onPress={() => setFilterStatus(status)}
            >
              <Text style={[
                DatabasesListStyles.filterChipText,
                filterStatus === status && DatabasesListStyles.filterChipTextActive
              ]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Databases List */}
      {filteredDatabases.length > 0 ? (
        filteredDatabases.map((database) => (
          <TouchableOpacity
            key={database.id || database.name}
            style={DatabasesListStyles.listItem}
            onPress={() => navigation.navigate('databaseDetails', { databaseName: database.name })}
            activeOpacity={0.7}
          >
            <View style={DatabasesListStyles.listItemContent}>
              <View style={DatabasesListStyles.listItemHeader}>
                <Text style={DatabasesListStyles.listItemTitle}>{database.name}</Text>
                <View style={[
                  DatabasesListStyles.statusBadge,
                  { backgroundColor: getStatusColor(database.status) + '20' }
                ]}>
                  <View style={[
                    DatabasesListStyles.statusDot,
                    { backgroundColor: getStatusColor(database.status) }
                  ]} />
                  <Text style={[
                    DatabasesListStyles.statusText,
                    { color: getStatusColor(database.status) }
                  ]}>
                    {database.status}
                  </Text>
                </View>
              </View>
              <Text style={DatabasesListStyles.listItemSubtitle}>
                {database.type} • Port: {database.port || 'N/A'} • {database.container_name || 'N/A'}
              </Text>
              {database.host && (
                <Text style={DatabasesListStyles.listItemSubtitle}>
                  Host: {database.host}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))
      ) : (
        <View style={DatabasesListStyles.emptyState}>
          <Ionicons name="server-outline" size={48} color={colors.textMuted} />
          <Text style={DatabasesListStyles.emptyText}>
            {searchQuery || filterType !== 'all' || filterStatus !== 'all'
              ? 'No databases match your filters'
              : 'No databases found'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

