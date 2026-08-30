import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_SIZE = 25;
const GRID_ROWS = Math.ceil(SCREEN_HEIGHT / GRID_SIZE) + 6;
const GRID_COLS = Math.ceil(SCREEN_WIDTH / GRID_SIZE) + 6;

// Very light grey colors - barely visible but actually visible
const GREY_COLORS = ['#F8F8F8', '#F5F5F5', '#F0F0F0', '#EBEBEB'];

export const AnimatedBackground = () => {
  const animationFrameRef = useRef(null);
  const [cellOpacities, setCellOpacities] = useState({});
  const cellStatesRef = useRef({});

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Initialize cell states
    const totalCells = GRID_ROWS * GRID_COLS;
    const initialOpacities = {};
    const states = {};
    
    for (let i = 0; i < totalCells; i++) {
      const row = Math.floor(i / GRID_COLS);
      const col = i % GRID_COLS;
      const key = `${row}-${col}`;
      
      states[key] = {
        phase: Math.random() * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.001,
        delay: Date.now() + 500 + Math.random() * 1000, // Start after 0.5 seconds, then stagger
        started: false,
        startTime: 0,
        row,
        col,
      };
      
      initialOpacities[key] = 0; // Start invisible - all white
    }
    
    cellStatesRef.current = states;
    setCellOpacities(initialOpacities);

    const animateCells = () => {
      const time = Date.now();
      const newOpacities = {};

      Object.keys(cellStatesRef.current).forEach((key) => {
        const state = cellStatesRef.current[key];
        if (!state) return;

        // Wait for delay before starting animation
        if (!state.started) {
          if (time < state.delay) {
            newOpacities[key] = 0;
            return;
          }
          state.started = true;
          state.startTime = time;
        }

        // Create breathing effect with sine wave - only show ~20% at peak
        const elapsed = (time - state.startTime) * state.speed;
        const sineValue = Math.sin(elapsed + state.phase);
        // Only show boxes when sine is above 0.6 (top 20% of the wave)
        const opacity = sineValue > 0.6 ? (sineValue - 0.6) * 1.25 : 0; // 0 to ~0.5, but only visible ~20% of time
        
        newOpacities[key] = opacity;
      });

      setCellOpacities(newOpacities);
      animationFrameRef.current = requestAnimationFrame(animateCells);
    };

    // Start animation after a delay
    const timeout = setTimeout(() => {
      animationFrameRef.current = requestAnimationFrame(animateCells);
    }, 500);

    return () => {
      clearTimeout(timeout);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Generate grid rows
  const renderGrid = () => {
    const rows = [];
    
    for (let row = 0; row < GRID_ROWS; row++) {
      const cells = [];
      for (let col = 0; col < GRID_COLS; col++) {
        const cellIndex = `${row}-${col}`;
        const colorIndex = (row + col) % GREY_COLORS.length;
        const opacity = cellOpacities[cellIndex] !== undefined ? cellOpacities[cellIndex] : 0;
        
        cells.push(
          <View
            key={cellIndex}
            style={[
              styles.cell,
              {
                backgroundColor: GREY_COLORS[colorIndex],
                opacity: opacity,
              },
            ]}
          />
        );
      }
      rows.push(
        <View key={row} style={styles.row}>
          {cells}
        </View>
      );
    }
    return rows;
  };

  return (
    <View style={styles.container}>
      <View style={styles.gridContainer}>
        {renderGrid()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  gridContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  cell: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    margin: 0.5,
    ...(Platform.OS === 'web' && {
      transition: 'opacity 1s ease-in-out, background-color 0.5s ease-in-out',
    }),
  },
});
