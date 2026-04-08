/**
 * VoiceNoteUploadService — uploads a local audio file to the Matrix media
 * repository and returns the mxc:// URI.
 *
 * The concrete implementation depends on matrix-js-sdk's `uploadContent`.
 * Tests can inject a stub that returns a predictable mxc URI.
 */

export interface VoiceNoteUploader {
  /**
   * Upload the file at `localPath` to the media repository.
   * Returns the mxc:// URI for use in the m.audio message content.
   */
  upload(localPath: string, mimeType: string): Promise<string>;
}

/**
 * Implementation that delegates to the Matrix client's uploadContent API.
 * `matrixClient` is typed minimally to avoid importing matrix-js-sdk directly.
 */
export class MatrixVoiceNoteUploader implements VoiceNoteUploader {
  constructor(
    private readonly matrixClient: {
      uploadContent(data: Blob | ArrayBuffer, opts?: {name?: string; type?: string}): Promise<{content_uri: string}>;
    },
  ) {}

  async upload(localPath: string, mimeType: string): Promise<string> {
    // React Native: fetch the local file as a blob
    const response = await fetch(localPath);
    const blob = await response.blob();
    const result = await this.matrixClient.uploadContent(blob, {
      name: 'voice-note.m4a',
      type: mimeType,
    });
    return result.content_uri;
  }
}
