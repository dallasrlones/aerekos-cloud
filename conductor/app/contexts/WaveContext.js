import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { Animated } from 'react-native';

const WaveContext = createContext(null);

export const WaveProvider = ({ children }) => {
  const waveAnim = useRef(new Animated.Value(0)).current;
  const [wavePosition, setWavePosition] = useState(0);

  useEffect(() => {
    // Listen to wave animation changes
    const listenerId = waveAnim.addListener(({ value }) => {
      setWavePosition(value);
    });

    return () => {
      if (listenerId) {
        waveAnim.removeListener(listenerId);
      }
    };
  }, [waveAnim]);

  return (
    <WaveContext.Provider value={{ waveAnim, wavePosition }}>
      {children}
    </WaveContext.Provider>
  );
};

export const useWave = () => {
  const context = useContext(WaveContext);
  if (!context) {
    throw new Error('useWave must be used within WaveProvider');
  }
  return context;
};
