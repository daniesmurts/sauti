/**
 * Jest manual mock for react-native-image-resizer.
 */

export interface ResizeResult {
  uri: string;
  width: number;
  height: number;
  size: number;
}

const ImageResizer = {
  createResizedImage: jest.fn(
    (
      path: string,
      maxWidth: number,
      maxHeight: number,
      format: string,
      quality: number,
    ): Promise<ResizeResult> =>
      Promise.resolve({
        uri: `file:///mock/resized-${maxWidth}x${maxHeight}-q${quality}.${format.toLowerCase()}`,
        width: maxWidth,
        height: maxHeight,
        size: 50000,
      }),
  ),
};

export default ImageResizer;
