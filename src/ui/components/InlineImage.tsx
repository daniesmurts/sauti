/**
 * InlineImage — renders an image inline in the message list.
 *
 * Behaviour:
 *  - When autoDownload is true (or omitted): shows the image, tap to expand.
 *  - When autoDownload is false: shows a download card; tapping it triggers
 *    onDownload and then shows the image.
 *
 * The expanded full-screen view is a Modal overlay.
 */

import React from 'react';
import {
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Colors, Radius, Spacing} from '../tokens';

export interface InlineImageProps {
  /** Resolved http/https or mxc-converted URL to display. */
  uri: string;
  width: number;
  height: number;
  /** When false, shows a download prompt instead of the image. */
  autoDownload?: boolean;
  onDownload?(): void;
  testID?: string;
}

export function InlineImage({
  uri,
  width,
  height,
  autoDownload = true,
  onDownload,
  testID,
}: InlineImageProps): React.JSX.Element {
  const [downloaded, setDownloaded] = React.useState(autoDownload);
  const [expanded, setExpanded] = React.useState(false);

  const handleDownload = React.useCallback(() => {
    setDownloaded(true);
    onDownload?.();
  }, [onDownload]);

  // Constrain to a max preview width of 220, preserving aspect ratio.
  const previewWidth = Math.min(width, 220);
  const previewHeight = height > 0 ? Math.round((previewWidth / width) * height) : previewWidth;

  if (!downloaded) {
    return (
      <TouchableOpacity
        style={styles.downloadCard}
        accessibilityLabel="Download image"
        onPress={handleDownload}
        testID={testID ?? 'inline-image-download'}>
        <Text style={styles.downloadIcon}>📷</Text>
        <Text style={styles.downloadLabel}>Tap to download</Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <TouchableOpacity
        accessibilityLabel="Expand image"
        onPress={() => setExpanded(true)}
        testID={testID ?? 'inline-image'}>
        <Image
          source={{uri}}
          style={[styles.preview, {width: previewWidth, height: previewHeight}]}
          resizeMode="cover"
          testID="inline-image-thumbnail"
        />
      </TouchableOpacity>

      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
        testID="inline-image-modal">
        <SafeAreaView style={styles.modalBg}>
          <TouchableOpacity
            style={styles.closeBtn}
            accessibilityLabel="Close image"
            onPress={() => setExpanded(false)}
            testID="inline-image-close">
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Image
            source={{uri}}
            style={styles.fullImage}
            resizeMode="contain"
            testID="inline-image-full"
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  downloadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0,0,0,0.08)',
    minWidth: 160,
  },
  downloadIcon: {fontSize: 20},
  downloadLabel: {
    fontSize: 13,
    color: Colors.neutral[600],
  },
  preview: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: Colors.neutral[0],
    fontSize: 16,
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});
