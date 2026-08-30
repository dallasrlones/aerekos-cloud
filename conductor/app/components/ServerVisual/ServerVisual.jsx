import React from 'react';
import { View, Text, Platform } from 'react-native';
import { ServerVisualStyles } from './ServerVisual.styles';
import { colors } from '../../styles/theme';

export const ServerVisual = ({ 
  hostname, 
  status, 
  cpuCores, 
  ramGB, 
  diskGB,
  networkMbps,
  lastSeen,
  deviceId 
}) => {

  return (
    <View style={ServerVisualStyles.container}>
      {/* Futuristic 3D Server */}
      <View style={ServerVisualStyles.serverContainer}>
        <View style={ServerVisualStyles.server3D}>
          {/* Front Panel */}
          <View style={ServerVisualStyles.frontPanel}>
            {/* Ventilation Grilles */}
            <View style={ServerVisualStyles.ventTop} />
            
            {/* LCD Display Areas */}
            <View style={ServerVisualStyles.displayArea}>
              <View style={ServerVisualStyles.lcdDisplay}>
                <Text style={ServerVisualStyles.lcdLabel}>NAME</Text>
                <Text style={ServerVisualStyles.lcdValue} numberOfLines={1}>
                  {hostname || 'UNKNOWN'}
                </Text>
              </View>
            </View>

            <View style={ServerVisualStyles.displayRow}>
              <View style={ServerVisualStyles.lcdDisplay}>
                <Text style={ServerVisualStyles.lcdLabel}>CPU</Text>
                <Text style={ServerVisualStyles.lcdValue}>{cpuCores || 0}</Text>
                <Text style={ServerVisualStyles.lcdUnit}>cores</Text>
              </View>
              <View style={ServerVisualStyles.lcdDisplay}>
                <Text style={ServerVisualStyles.lcdLabel}>RAM</Text>
                <Text style={ServerVisualStyles.lcdValue}>{ramGB || 0}</Text>
                <Text style={ServerVisualStyles.lcdUnit}>GB</Text>
              </View>
            </View>

            <View style={ServerVisualStyles.displayRow}>
              <View style={ServerVisualStyles.lcdDisplay}>
                <Text style={ServerVisualStyles.lcdLabel}>DISK</Text>
                <Text style={ServerVisualStyles.lcdValue}>{diskGB || 0}</Text>
                <Text style={ServerVisualStyles.lcdUnit}>GB</Text>
              </View>
              <View style={ServerVisualStyles.lcdDisplay}>
                <Text style={ServerVisualStyles.lcdLabel}>NET</Text>
                <Text style={ServerVisualStyles.lcdValue}>{networkMbps || 0}</Text>
                <Text style={ServerVisualStyles.lcdUnit}>Mbps</Text>
              </View>
            </View>

            {/* Status LED */}
            <View style={[ServerVisualStyles.statusLED, { backgroundColor: status === 'online' ? colors.textSecondary : colors.textMuted }]} />

            {/* Bottom Ventilation */}
            <View style={ServerVisualStyles.ventBottom} />
          </View>

          {/* Top Panel */}
          <View style={ServerVisualStyles.topPanel} />

          {/* Right Side Panel */}
          <View style={ServerVisualStyles.sidePanel} />
        </View>
      </View>
    </View>
  );
};

