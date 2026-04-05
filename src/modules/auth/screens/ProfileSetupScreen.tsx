import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {Button, Input, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';

export interface ProfileSetupPayload {
  displayName: string;
  avatarUri?: string;
}

export interface ProfileSetupScreenProps {
  loading?: boolean;
  onSubmit(payload: ProfileSetupPayload): void;
}

const AVATAR_SIZE = 96;

function isValidDisplayName(value: string): boolean {
  return value.trim().length >= 2 && value.trim().length <= 60;
}

export function ProfileSetupScreen({
  loading = false,
  onSubmit,
}: ProfileSetupScreenProps): React.JSX.Element {
  const [displayName, setDisplayName] = React.useState('');
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>();
  const [nameError, setNameError] = React.useState<string | undefined>();

  const handlePickAvatar = React.useCallback(() => {
    // Avatar picker integration (camera-roll / react-native-image-picker) will
    // be wired in Phase 2.  For now we accept a URI injected via test or left
    // undefined.
    setAvatarUri(undefined);
  }, []);

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
          disabled={loading}>
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
          <Text style={styles.avatarHint}>Tap to change</Text>
        </TouchableOpacity>

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
          editable={!loading}
        />

        <View style={styles.cta}>
          <Button
            label="Continue"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading || displayName.trim().length < 2}
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
  cta: {
    marginTop: Spacing.sm,
  },
});
