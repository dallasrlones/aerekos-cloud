import React from 'react';
import { View, Text, Platform } from 'react-native';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartStyles } from './Chart.styles';
import { colors } from '../../styles/theme';

// Web-only chart component using recharts
export const Chart = ({ title, data, dataKey, color = '#4CAF50', height = 200, unit = '%' }) => {
  // Only render on web platform
  if (Platform.OS !== 'web') {
    return (
      <View style={ChartStyles.container}>
        <Text style={ChartStyles.title}>{title}</Text>
        <Text style={ChartStyles.notSupported}>Charts are only available on web</Text>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={ChartStyles.container}>
        <Text style={ChartStyles.title}>{title}</Text>
        <Text style={ChartStyles.noData}>No data available</Text>
      </View>
    );
  }

  // Format timestamp for X-axis (show relative time)
  const formatTime = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  // Prepare data for chart (show last 20 points for readability)
  const chartData = data.slice(-20).map((point, idx) => ({
    ...point,
    timeLabel: idx === data.slice(-20).length - 1 ? 'now' : formatTime(point.timestamp),
  }));

  return (
    <View style={ChartStyles.container}>
      {title && <Text style={ChartStyles.title}>{title}</Text>}
      <View style={[ChartStyles.chartContainer, { height }]}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
            <XAxis 
              dataKey="timeLabel" 
              stroke={colors.textSecondary}
              fontSize={10}
              tick={{ fill: colors.textSecondary }}
            />
            <YAxis 
              stroke={colors.textSecondary}
              fontSize={10}
              tick={{ fill: colors.textSecondary }}
              domain={[0, unit === '%' ? 100 : 'auto']}
              label={{ value: unit, angle: -90, position: 'insideLeft', fill: colors.textSecondary }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: colors.cardBackground, 
                border: `1px solid ${colors.border}`,
                borderRadius: 4,
                color: colors.textPrimary
              }}
              labelStyle={{ color: colors.textPrimary }}
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </View>
    </View>
  );
};

