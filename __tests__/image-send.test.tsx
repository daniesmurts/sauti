/**
 * Image send/receive tests.
 *
 * Covers:
 *  - compress.ts: correct params passed to ImageResizer for outbound, inbound, thumbnail
 *  - InlineImage: renders thumbnail when autoDownload=true
 *  - InlineImage: renders download card when autoDownload=false
 *  - InlineImage: switches to image after download is tapped
 *  - InlineImage: opens/closes expand modal on tap
 *  - ImageUploadService: calls compress then upload
 */

import 'react-native';
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it, jest, beforeEach} from '@jest/globals';

import ImageResizer from 'react-native-image-resizer';
import {compressOutbound, compressInbound, makeThumbnail} from '../src/utils/compress';
import {InlineImage} from '../src/ui/components/InlineImage';
import {ImageUploadService} from '../src/modules/main/image/ImageUploadService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function findByTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll(n => n.props.testID === id)[0] ?? null;
}

// ── compress.ts ───────────────────────────────────────────────────────────────

describe('compress utilities', () => {
  beforeEach(() => {
    (ImageResizer.createResizedImage as jest.Mock).mockClear();
  });

  it('compressOutbound uses max 1280px, quality 70, JPEG', async () => {
    await compressOutbound('file:///photo.jpg');
    expect(ImageResizer.createResizedImage).toHaveBeenCalledWith(
      'file:///photo.jpg',
      1280,
      1280,
      'JPEG',
      70,
    );
  });

  it('compressInbound uses max 1280px, quality 75, JPEG', async () => {
    await compressInbound('file:///photo.jpg');
    expect(ImageResizer.createResizedImage).toHaveBeenCalledWith(
      'file:///photo.jpg',
      1280,
      1280,
      'JPEG',
      75,
    );
  });

  it('makeThumbnail uses max 200px, quality 60, JPEG', async () => {
    await makeThumbnail('file:///photo.jpg');
    expect(ImageResizer.createResizedImage).toHaveBeenCalledWith(
      'file:///photo.jpg',
      200,
      200,
      'JPEG',
      60,
    );
  });

  it('returns the resized URI from ImageResizer', async () => {
    const result = await compressOutbound('file:///photo.jpg');
    expect(result.uri).toContain('resized');
  });
});

// ── InlineImage ───────────────────────────────────────────────────────────────

describe('InlineImage', () => {
  it('renders thumbnail image when autoDownload is true', () => {
    const tree = renderer.create(
      <InlineImage uri="https://cdn/img.jpg" width={800} height={600} autoDownload />,
    );
    expect(findByTestID(tree, 'inline-image-thumbnail')).not.toBeNull();
    expect(findByTestID(tree, 'inline-image-download')).toBeNull();
  });

  it('renders download card when autoDownload is false', () => {
    const tree = renderer.create(
      <InlineImage uri="https://cdn/img.jpg" width={800} height={600} autoDownload={false} />,
    );
    expect(findByTestID(tree, 'inline-image-download')).not.toBeNull();
    expect(findByTestID(tree, 'inline-image-thumbnail')).toBeNull();
  });

  it('defaults to autoDownload=true when prop omitted', () => {
    const tree = renderer.create(
      <InlineImage uri="https://cdn/img.jpg" width={800} height={600} />,
    );
    expect(findByTestID(tree, 'inline-image-thumbnail')).not.toBeNull();
  });

  it('shows image after tapping download card', async () => {
    const onDownload = jest.fn();
    const tree = renderer.create(
      <InlineImage
        uri="https://cdn/img.jpg"
        width={800}
        height={600}
        autoDownload={false}
        onDownload={onDownload}
      />,
    );

    await act(async () => {
      findByTestID(tree, 'inline-image-download')?.props.onPress();
    });

    expect(findByTestID(tree, 'inline-image-thumbnail')).not.toBeNull();
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('opens expand modal when thumbnail is tapped', async () => {
    const tree = renderer.create(
      <InlineImage uri="https://cdn/img.jpg" width={800} height={600} autoDownload />,
    );

    // Before tap: full image not visible
    expect(findByTestID(tree, 'inline-image-full')).toBeNull();

    await act(async () => {
      findByTestID(tree, 'inline-image')?.props.onPress();
    });

    expect(findByTestID(tree, 'inline-image-full')).not.toBeNull();
  });

  it('closes modal when close button is tapped', async () => {
    const tree = renderer.create(
      <InlineImage uri="https://cdn/img.jpg" width={800} height={600} autoDownload />,
    );

    await act(async () => {
      findByTestID(tree, 'inline-image')?.props.onPress();
    });
    await act(async () => {
      findByTestID(tree, 'inline-image-close')?.props.onPress();
    });

    expect(findByTestID(tree, 'inline-image-full')).toBeNull();
  });
});

// ── ImageUploadService ────────────────────────────────────────────────────────

describe('ImageUploadService', () => {
  beforeEach(() => {
    (ImageResizer.createResizedImage as jest.Mock).mockClear();
    // Mock fetch for the blob reads
    global.fetch = jest.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['data'], {type: 'image/jpeg'})),
    }) as unknown as typeof fetch;
  });

  it('compresses the image before uploading', async () => {
    const uploader = {
      upload: jest.fn().mockResolvedValue({content_uri: 'mxc://server/abc'}),
    };
    const service = new ImageUploadService(uploader);
    await service.uploadImage('file:///photo.jpg');

    // Both compressOutbound and makeThumbnail called
    expect(ImageResizer.createResizedImage).toHaveBeenCalledTimes(2);
  });

  it('calls uploader twice (main + thumbnail) and returns mxc URIs', async () => {
    let callCount = 0;
    const uploader = {
      upload: jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({content_uri: `mxc://server/${callCount}`});
      }),
    };
    const service = new ImageUploadService(uploader);
    const result = await service.uploadImage('file:///photo.jpg');

    expect(uploader.upload).toHaveBeenCalledTimes(2);
    expect(result.mxcUri).toBe('mxc://server/1');
    expect(result.thumbnailMxcUri).toBe('mxc://server/2');
  });
});
