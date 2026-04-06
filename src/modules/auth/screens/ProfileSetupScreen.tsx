import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {pickProfileAvatar} from '../api';
import {Button, Input, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';

export interface ProfileSetupPayload {
  displayName: string;
  avatarUri?: string;
}

export interface ProfileSetupScreenProps {
  loading?: boolean;
  pickAvatar?: () => Promise<string | undefined>;
  onSubmit(payload: ProfileSetupPayload): void;
}

const AVATAR_SIZE = 96;

function isValidDisplayName(value: string): boolean {
  return value.trim().length >= 2 && value.trim().length <= 60;
}

export function ProfileSetupScreen({
  loading = false,
  pickAvatar = pickProfileAvatar,
  onSubmit,
}: ProfileSetupScreenProps): React.JSX.Element {
  const [displayName, setDisplayName] = React.useState('');
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>();
  const [nameError, setNameError] = React.useState<string | undefined>();
  const [avatarError, setAvatarError] = React.useState<string | undefined>();
  const [avatarLoading, setAvatarLoading] = React.useState(false);

  const handlePickAvatar = React.useCallback(async () => {
    if (loading || avatarLoading) {
      return;
    }

    setAvatarLoading(true);
    setAvatarError(undefined);

    try {
      const selectedAvatarUri = await pickAvatar();

      if (selectedAvatarUri) {
        setAvatarUri(selectedAvatarUri);
      }
    } catch (error) {
      setAvatarError(
        error instanceof Error ? error.message : 'Unable to select avatar image.',
      );
    } finally {
      setAvatarLoading(false);
    }
  }, [avatarLoading, loading, pickAvatar]);

  const handleSubmit = React.useCallback(() => {
    const trimmed = displayName.trim();

    if (!isValidDisplayName(trimmed)) {
      setNameError('Display name must be 2–60 characters.');
      return;
    }

    setNameError(undefined);
    onSubmit({
      displayName: trimmed,
      avatarUri,
    });
  }, [avatarUri, displayName, onSubmit]);

  return (
    <Screen avoidKeyboard>
      <View style={styles.container}>
        <Text style={[TextPresets.h2, styles.title]}>Set Up Your Profile</Text>
        <Text style={[TextPresets.body, styles.description]}>
          Choose a display name that contacts will see.
        </Text>

        {/* Avatar picker */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handlePickAvatar}
          accessibilityLabel="pick-avatar"
          disabled={loading || avatarLoading}>
          {avatarUri ? (
            <Image
              source={{uri: avatarUri}}
              style={styles.avatarImage}
              accessibilityLabel="avatar-preview"
            />
          ) : (
            <View style={styles.avatarPlaceholder} testID="avatar-placeholder">
              <Text style={styles.avatarInitial}>
                {displayName.trim().charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <Text style={styles.avatarHint}>
            {avatarLoading
              ? 'Opening photo library...'
              : avatarUri
                ? 'Tap to change'
                : 'Tap to choose a photo'}
          </Text>
        </TouchableOpacity>
        {avatarError ? <Text style={styles.avatarError}>{avatarError}</Text> : null}

        <Input
          label="Display Name"
          value={displayName}
          onChangeText={value => {
            setDisplayName(value);
            if (nameError) {
              setNameError(undefined);
            }
          }}
          autoCorrect={false}
          autoCapitalize="words"
          placeholder="Kwame Asante"
          maxLength={60}
          error={nameError}
          editable={!loading && !avatarLoading}
        />

        <View style={styles.cta}>
          <Button
            label="Continue"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading || avatarLoading || displayName.trim().length < 2}
            accessibilityLabel="profile-setup-continue"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.base,
  },
  title: {
    color: Colors.neutral[900],
  },
  description: {
    color: Colors.neutral[600],
  },
  avatarContainer: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.brand[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    ...TextPresets.h1,
    color: Colors.brand[600],
  },
  avatarHint: {
    ...TextPresets.caption,
    color: Colors.neutral[500],
  },
  avatarError: {
    ...TextPresets.caption,
    color: Colors.semantic.error,
    textAlign: 'center',
  },
  cta: {
    marginTop: Spacing.sm,
  },
});
