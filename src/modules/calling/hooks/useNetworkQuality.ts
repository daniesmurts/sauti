import React from 'react';
import NetInfo from '@react-native-community/netinfo';
import {presetForNetwork, QualityPreset} from '../webrtc/IceConfig';

export type NetworkQuality = 'wifi' | '4g' | '3g' | '2g' | 'offline' | 'unknown';

function toNetworkQuality(type: string | null, effectiveType: string | null | undefined): NetworkQuality {
  if (!type || type === 'none' || type === 'unknown') return 'offline';
  if (type === 'wifi') return 'wifi';
  if (type === 'cellular') {
    switch (effectiveType) {
      case '4g': return '4g';
      case '3g': return '3g';
      case '2g': return '2g';
      default: return 'unknown';
    }
  }
  return 'unknown';
}

/**
 * Returns the current network quality and the recommended call quality preset.
 * Subscribes to NetInfo and updates reactively.
 */
export function useNetworkQuality(videoEnabled = false): {
  networkQuality: NetworkQuality;
  recommendedPreset: QualityPreset;
} {
  const [quality, setQuality] = React.useState<NetworkQuality>('unknown');

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setQuality(
        toNetworkQuality(
          state.type,
          (state.details as {cellularGeneration?: string} | null)?.cellularGeneration ?? null,
        ),
      );
    });
    return unsubscribe;
  }, []);

  return {
    networkQuality: quality,
    recommendedPreset: presetForNetwork(quality, videoEnabled),
  };
}
