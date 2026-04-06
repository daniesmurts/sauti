import {launchImageLibrary} from 'react-native-image-picker';

export async function pickProfileAvatar(): Promise<string | undefined> {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    includeBase64: false,
  });

  if (result.didCancel) {
    return undefined;
  }

  if (result.errorCode) {
    throw new Error(result.errorMessage ?? 'Unable to select avatar image.');
  }

  const uri = result.assets?.[0]?.uri;
  if (!uri) {
    throw new Error('Selected avatar image is unavailable.');
  }

  return uri;
}