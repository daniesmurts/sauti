/**
 * CallScreen adaptive quality tests.
 *
 * Covers:
 *  - Network quality indicator rendering for each quality level
 *  - Downgrade banner appearance / dismissal / confirm actions
 *  - Track-level mute (audio track enabled flag)
 *  - Track-level camera toggle (video track enabled flag)
 *  - Status label text at each call state
 */

import 'react-native';
import React from 'react';
import {TouchableOpacity} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it, jest, beforeEach, afterEach, afterAll} from '@jest/globals';
import NetInfo from '@react-native-community/netinfo';

import {CallScreen} from '../src/modules/calling/screens/CallScreen';
import {CallManager} from '../src/modules/calling/webrtc/CallManager';
import {CallSignaling, type CallSignalingTransport} from '../src/modules/calling/webrtc/CallSignaling';
import {RTCPeerConnection, MediaStream, MediaStreamTrack} from 'react-native-webrtc';

// Prevent real timers (ring timeout etc.) from firing between tests.
beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

// ── Helpers ──────────────────────────────────────────────────────────────────

type NetInfoListener = (state: {type: string; details?: {cellularGeneration?: string} | null}) => void;
let capturedNetInfoListener: NetInfoListener | null = null;

function fireNetInfo(type: string, cellularGeneration?: string): void {
  capturedNetInfoListener?.({
    type,
    details: cellularGeneration ? {cellularGeneration} : null,
  });
}

function makeTransport(): jest.Mocked<CallSignalingTransport> & {
  _emit: (roomId: string, senderId: string, type: string, content: unknown) => void;
} {
  let h: ((r: string, s: string, t: string, c: unknown) => void) | null = null;
  return {
    sendRoomEvent: jest.fn<Promise<void>, [string, string, object]>().mockResolvedValue(undefined),
    subscribeCallEvents: jest.fn().mockImplementation((handler: typeof h) => {
      h = handler;
      return () => { h = null; };
    }),
    _emit(roomId, senderId, type, content) { h?.(roomId, senderId, type, content); },
  };
}

function makeConnectedManager(): {
  manager: CallManager;
  transport: ReturnType<typeof makeTransport>;
  pc: RTCPeerConnection & {_simulateIceConnected(): void};
} {
  const transport = makeTransport();
  const signaling = new CallSignaling(transport);
  let lastPc: RTCPeerConnection | null = null;

  const manager = new CallManager({
    iceConfig: {iceServers: [], iceTransportPolicy: 'relay', bundlePolicy: 'max-bundle'},
    signaling,
    localUserId: '@self:sauti.test',
    createPeerConnection: (cfg) => {
      const p = new RTCPeerConnection(cfg);
      lastPc = p;
      return p;
    },
  });

  return {
    manager,
    transport,
    get pc() {
      return lastPc as RTCPeerConnection & {_simulateIceConnected(): void};
    },
  };
}

function findByTestID(tree: renderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(n => n.props.testID === testID)[0] ?? null;
}

function findButton(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root.findAll(
    n => n.type === TouchableOpacity && n.props.accessibilityLabel === label,
  )[0] ?? null;
}

const ROOM = '!room:sauti.test';
const PEER = '@peer:sauti.test';

// ── Setup ─────────────────────────────────────────────────────────────────────

// Track trees and managers for cleanup
const managersToDestroy: CallManager[] = [];
const treesToUnmount: renderer.ReactTestRenderer[] = [];

function track(manager: CallManager): CallManager {
  managersToDestroy.push(manager);
  return manager;
}
function trackTree(tree: renderer.ReactTestRenderer): renderer.ReactTestRenderer {
  treesToUnmount.push(tree);
  return tree;
}

beforeEach(() => {
  capturedNetInfoListener = null;
  (NetInfo.addEventListener as jest.Mock).mockImplementation((listener: NetInfoListener) => {
    capturedNetInfoListener = listener;
    return () => { capturedNetInfoListener = null; };
  });
});

afterEach(() => {
  // Unmount renderers then destroy managers to avoid stale state updates
  treesToUnmount.splice(0).forEach(t => { try { t.unmount(); } catch {} });
  managersToDestroy.splice(0).forEach(m => m.destroy());
  jest.clearAllTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CallScreen', () => {

  describe('network quality indicator', () => {
    it('renders the network quality indicator', () => {
      const {manager} = makeConnectedManager();
      const tree = trackTree(renderer.create(<CallScreen manager={track(manager)} />));
      expect(findByTestID(tree, 'network-quality-indicator')).not.toBeNull();
    });

    it('indicator is present for each quality level without throwing', async () => {
      const {manager, transport} = makeConnectedManager();
      const tree = trackTree(renderer.create(<CallScreen manager={track(manager)} />));

      for (const [type, gen] of [
        ['wifi', undefined],
        ['cellular', '4g'],
        ['cellular', '3g'],
        ['cellular', '2g'],
        ['none', undefined],
        ['unknown', undefined],
      ] as const) {
        await act(async () => { fireNetInfo(type, gen); });
        expect(findByTestID(tree, 'network-quality-indicator')).not.toBeNull();
      }
      transport.sendRoomEvent.mockReset();
    });
  });

  describe('status label', () => {
    // React's internal scheduler uses setTimeout(0) — needs real timers to flush.
    beforeEach(() => jest.useRealTimers());
    afterEach(() => { jest.clearAllTimers(); jest.useFakeTimers(); });

    it('shows "Calling…" while ringing_out', async () => {
      const {manager} = makeConnectedManager();
      const tree = trackTree(renderer.create(<CallScreen manager={track(manager)} />));
      // Flush useEffect so the manager subscription is established before placeCall
      await act(async () => {});

      await act(async () => { await manager.placeCall(ROOM, PEER); });

      const label = findByTestID(tree, 'call-status-label');
      expect(label?.props.children).toBe('Calling…');
    });

    it('shows "Connecting…" after answer received', async () => {
      const result = makeConnectedManager();
      const {manager, transport} = result;
      const tree = trackTree(renderer.create(<CallScreen manager={track(manager)} />));
      await act(async () => {}); // flush useEffect subscription

      await act(async () => { await manager.placeCall(ROOM, PEER); });
      const callId = (manager.getState() as {call: {callId: string}}).call.callId;

      await act(async () => {
        transport._emit(ROOM, PEER, 'm.call.answer', {
          call_id: callId,
          answer: {type: 'answer', sdp: 'sdp'},
          version: '1',
        });
        await Promise.resolve();
      });

      const label = findByTestID(tree, 'call-status-label');
      expect(label?.props.children).toBe('Connecting…');
    });
  });

  describe('mute toggle (track-level)', () => {
    it('disables audio tracks when muted', async () => {
      const result = makeConnectedManager();
      const {manager, transport} = result;
      const tree = trackTree(renderer.create(<CallScreen manager={track(manager)} />));

      await act(async () => { await manager.placeCall(ROOM, PEER); });
      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      await act(async () => {
        transport._emit(ROOM, PEER, 'm.call.answer', {
          call_id: callId, answer: {type: 'answer', sdp: 'sdp'}, version: '1',
        });
        await Promise.resolve();
      });
      await act(async () => { result.pc._simulateIceConnected(); });

      const audioTrack = (manager as unknown as {localStream: MediaStream})
        .localStream?.getAudioTracks()[0] as MediaStreamTrack & {enabled: boolean};
      expect(audioTrack?.enabled).toBe(true);

      await act(async () => { findButton(tree, 'Mute')?.props.onPress(); });
      expect(audioTrack?.enabled).toBe(false);

      await act(async () => { findButton(tree, 'Unmute')?.props.onPress(); });
      expect(audioTrack?.enabled).toBe(true);
    });
  });

  describe('camera toggle (track-level)', () => {
    it('disables video tracks when camera turned off', async () => {
      const result = makeConnectedManager();
      const {manager, transport} = result;

      const {mediaDevices} = require('react-native-webrtc');
      const videoTrack = new MediaStreamTrack('video');
      const mockStream = new MediaStream([new MediaStreamTrack('audio'), videoTrack]);
      mediaDevices.getUserMedia.mockResolvedValueOnce(mockStream);

      const tree = trackTree(renderer.create(<CallScreen manager={track(manager)} />));

      await act(async () => { await manager.placeCall(ROOM, PEER); });
      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      await act(async () => {
        transport._emit(ROOM, PEER, 'm.call.answer', {
          call_id: callId, answer: {type: 'answer', sdp: 'sdp'}, version: '1',
        });
        await Promise.resolve();
      });
      await act(async () => { result.pc._simulateIceConnected(); });

      expect(videoTrack.enabled).toBe(true);
      await act(async () => { findButton(tree, 'Turn on camera')?.props.onPress(); });
      await act(async () => { findButton(tree, 'Turn off camera')?.props.onPress(); });
      expect(videoTrack.enabled).toBe(false);
    });
  });

  describe('downgrade banner', () => {
    type CMResult = ReturnType<typeof makeConnectedManager>;

    async function setupConnectedWithCamera(result: CMResult) {
      const {manager, transport} = result;
      const tree = trackTree(renderer.create(<CallScreen manager={manager} />));

      await act(async () => { await manager.placeCall(ROOM, PEER); });
      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      await act(async () => {
        transport._emit(ROOM, PEER, 'm.call.answer', {
          call_id: callId, answer: {type: 'answer', sdp: 'sdp'}, version: '1',
        });
        await Promise.resolve();
      });
      await act(async () => { result.pc._simulateIceConnected(); });
      await act(async () => { findButton(tree, 'Turn on camera')?.props.onPress(); });

      return tree;
    }

    it('shows downgrade banner when quality drops to 2g with camera on', async () => {
      const result = makeConnectedManager();
      track(result.manager);
      const tree = await setupConnectedWithCamera(result);

      await act(async () => { fireNetInfo('cellular', '2g'); });
      expect(findByTestID(tree, 'downgrade-banner')).not.toBeNull();
    });

    it('does not show banner when quality is good', async () => {
      const result = makeConnectedManager();
      track(result.manager);
      const tree = await setupConnectedWithCamera(result);

      await act(async () => { fireNetInfo('wifi'); });
      expect(findByTestID(tree, 'downgrade-banner')).toBeNull();
    });

    it('does not show banner when camera is off', async () => {
      const {manager} = makeConnectedManager();
      trackTree(renderer.create(<CallScreen manager={track(manager)} />));

      await act(async () => { fireNetInfo('cellular', '2g'); });
      expect(
        treesToUnmount[treesToUnmount.length - 1].root.findAll(
          n => n.props.testID === 'downgrade-banner',
        ).length,
      ).toBe(0);
    });

    it('dismisses banner when "Keep video" is pressed', async () => {
      const result = makeConnectedManager();
      track(result.manager);
      const tree = await setupConnectedWithCamera(result);

      await act(async () => { fireNetInfo('cellular', '2g'); });
      expect(findByTestID(tree, 'downgrade-banner')).not.toBeNull();

      await act(async () => { findByTestID(tree, 'downgrade-dismiss-button')?.props.onPress(); });
      expect(findByTestID(tree, 'downgrade-banner')).toBeNull();
    });

    it('turns off camera when "Voice only" is pressed', async () => {
      const result = makeConnectedManager();
      track(result.manager);
      const tree = await setupConnectedWithCamera(result);

      await act(async () => { fireNetInfo('cellular', '2g'); });
      await act(async () => { findByTestID(tree, 'downgrade-confirm-button')?.props.onPress(); });

      expect(findByTestID(tree, 'downgrade-banner')).toBeNull();
      expect(findButton(tree, 'Turn on camera')).not.toBeNull();
    });

    it('clears dismissal and shows banner again after quality recovers then drops', async () => {
      const result = makeConnectedManager();
      track(result.manager);
      const tree = await setupConnectedWithCamera(result);

      await act(async () => { fireNetInfo('cellular', '2g'); });
      await act(async () => { findByTestID(tree, 'downgrade-dismiss-button')?.props.onPress(); });
      expect(findByTestID(tree, 'downgrade-banner')).toBeNull();

      await act(async () => { fireNetInfo('wifi'); });
      await act(async () => { fireNetInfo('cellular', '2g'); });
      expect(findByTestID(tree, 'downgrade-banner')).not.toBeNull();
    });
  });
});
