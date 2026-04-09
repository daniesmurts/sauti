/**
 * Media compression utilities.
 *
 * All images are compressed via react-native-image-resizer before display
 * or transmission. Settings per spec (MASTER_SPEC.md §9.1):
 *
 *   Outbound : max 1280px, quality 70, JPEG
 *   Inbound  : max 1280px, quality 75, JPEG
 *   Thumbnail: max 200px,  quality 60, JPEG
 */

import ImageResizer from '@bam.tech/react-native-image-resizer';

export interface CompressResult {
  uri: string;
  width: number;
  height: number;
  size: number;
}

/** Compress an image before sending. */
export async function compressOutbound(localPath: string): Promise<CompressResult> {
  return ImageResizer.createResizedImage(
    localPath,
    1280,
    1280,
    'JPEG',
    70,
  );
}

/** Compress an inbound image before caching/displaying. */
export async function compressInbound(localPath: string): Promise<CompressResult> {
  return ImageResizer.createResizedImage(
    localPath,
    1280,
    1280,
    'JPEG',
    75,
  );
}

/** Generate a small thumbnail URI (for message list previews). */
export async function makeThumbnail(localPath: string): Promise<CompressResult> {
  return ImageResizer.createResizedImage(
    localPath,
    200,
    200,
    'JPEG',
    60,
  );
}
