/**
 * ImageUploadService — compresses an image and uploads it to the Matrix
 * media repository, returning the mxc:// URI and thumbnail mxc:// URI.
 */

import {compressOutbound, makeThumbnail} from '../../../utils/compress';

export interface ImageUploadResult {
  mxcUri: string;
  thumbnailMxcUri: string;
  width: number;
  height: number;
}

export interface MediaUploader {
  upload(data: Blob, opts: {name: string; type: string}): Promise<{content_uri: string}>;
}

export class ImageUploadService {
  constructor(private readonly uploader: MediaUploader) {}

  async uploadImage(localPath: string): Promise<ImageUploadResult> {
    const [compressed, thumbnail] = await Promise.all([
      compressOutbound(localPath),
      makeThumbnail(localPath),
    ]);

    const [mainBlob, thumbBlob] = await Promise.all([
      fetch(compressed.uri).then(r => r.blob()),
      fetch(thumbnail.uri).then(r => r.blob()),
    ]);

    const [mainResult, thumbResult] = await Promise.all([
      this.uploader.upload(mainBlob, {name: 'image.jpg', type: 'image/jpeg'}),
      this.uploader.upload(thumbBlob, {name: 'thumbnail.jpg', type: 'image/jpeg'}),
    ]);

    return {
      mxcUri: mainResult.content_uri,
      thumbnailMxcUri: thumbResult.content_uri,
      width: compressed.width,
      height: compressed.height,
    };
  }
}
