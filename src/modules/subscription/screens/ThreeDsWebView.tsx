/**
 * ThreeDsWebView — handles both 3DS v1.0 and v2.1 challenges inside a WebView.
 *
 * v1.0: posts an HTML form to the ACS URL with MD + PaReq + TermUrl.
 *        Listens for navigation to the TermUrl and extracts PaRes from the body.
 *
 * v2.1: navigates to ACS URL with encoded CReq param.
 *        Listens for the challenge completion notification URL redirect.
 *
 * On completion calls onComplete(paRes) for v1 or onComplete(null) for v2.
 * On cancel calls onCancel().
 */

import React from 'react';
import {StyleSheet, TouchableOpacity, Text, View} from 'react-native';
import WebView from 'react-native-webview';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';

const TERM_URL = 'https://securepay.tinkoff.ru/3ds/callback';

// ── v1.0 ──────────────────────────────────────────────────────────────────────

function buildV1Html(acsUrl: string, paReq: string, md: string): string {
  return `<!DOCTYPE html>
<html><body onload="document.forms[0].submit()">
<form method="POST" action="${escapeHtml(acsUrl)}">
  <input type="hidden" name="PaReq" value="${escapeHtml(paReq)}" />
  <input type="hidden" name="MD" value="${escapeHtml(md)}" />
  <input type="hidden" name="TermUrl" value="${TERM_URL}" />
</form>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ThreeDsWebViewV1Props {
  acsUrl: string;
  paReq: string;
  md: string;
  onComplete(paRes: string): void;
  onCancel(): void;
}

interface ThreeDsWebViewV2Props {
  acsUrl: string;
  cReq: string;
  onComplete(): void;
  onCancel(): void;
}

export type ThreeDsWebViewProps =
  | ({version: '1.0'} & ThreeDsWebViewV1Props)
  | ({version: '2.1'} & ThreeDsWebViewV2Props);

export function ThreeDsWebView(props: ThreeDsWebViewProps): React.JSX.Element {
  const [paRes, setPaRes] = React.useState('');

  const handleMessage = React.useCallback(
    (event: {nativeEvent: {data: string}}) => {
      // For v1.0: the page posts back a JSON with paRes
      try {
        const data = JSON.parse(event.nativeEvent.data) as {paRes?: string};
        if (data.paRes && props.version === '1.0') {
          props.onComplete(data.paRes);
        }
      } catch {}
    },
    [props],
  );

  const handleNavChange = React.useCallback(
    (state: {url: string}) => {
      if (props.version === '1.0') {
        // TermUrl hit — extract PaRes from injected script result
        if (state.url.startsWith(TERM_URL)) {
          const match = state.url.match(/[?&]PaRes=([^&]+)/);
          if (match) {
            props.onComplete(decodeURIComponent(match[1]));
          }
        }
      } else {
        // v2.1: challenge notification URL signals completion
        if (state.url.includes('challenge-complete') || state.url.startsWith(TERM_URL)) {
          props.onComplete();
        }
      }
    },
    [props],
  );

  const source =
    props.version === '1.0'
      ? {html: buildV1Html(props.acsUrl, props.paReq, props.md)}
      : {uri: `${props.acsUrl}?creq=${encodeURIComponent(props.cReq)}`};

  return (
    <View style={styles.container} testID="three-ds-container">
      <View style={styles.header}>
        <Text style={styles.title}>3D Secure verification</Text>
        <TouchableOpacity
          onPress={props.onCancel}
          accessibilityLabel="Cancel 3DS"
          testID="three-ds-cancel">
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <WebView
        source={source}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavChange}
        testID="three-ds-webview"
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.neutral[0]},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  title: {
    ...TextPresets.body,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  cancelText: {
    ...TextPresets.body,
    color: Colors.semantic.error,
  },
  webview: {flex: 1},
});
