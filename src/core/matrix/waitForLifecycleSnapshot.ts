import {SautiError} from './MatrixClient';
import {MatrixLifecycleEvent, MatrixLifecycleSnapshot} from './MatrixLifecycleService';

export interface MatrixLifecycleSnapshotSource {
  getSnapshot(): MatrixLifecycleSnapshot;
  subscribe(listener: (event: MatrixLifecycleEvent) => void): () => void;
}

export interface WaitForLifecycleSnapshotOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function waitForLifecycleSnapshot(
  source: MatrixLifecycleSnapshotSource,
  predicate: (snapshot: MatrixLifecycleSnapshot) => boolean,
  options: WaitForLifecycleSnapshotOptions = {},
): Promise<MatrixLifecycleSnapshot> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const current = source.getSnapshot();

  if (predicate(current)) {
    return current;
  }

  return new Promise<MatrixLifecycleSnapshot>((resolve, reject) => {
    let settled = false;

    const cleanupFns: Array<() => void> = [];

    const settle = (
      type: 'resolve' | 'reject',
      value: MatrixLifecycleSnapshot | SautiError,
    ) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanupFns.forEach(fn => fn());

      if (type === 'resolve') {
        resolve(value as MatrixLifecycleSnapshot);
        return;
      }

      reject(value);
    };

    const unsubscribe = source.subscribe(() => {
      const snapshot = source.getSnapshot();
      if (predicate(snapshot)) {
        settle('resolve', snapshot);
      }
    });
    cleanupFns.push(unsubscribe);

    const timeout = setTimeout(() => {
      settle(
        'reject',
        new SautiError(
          'MATRIX_LIFECYCLE_WAIT_TIMEOUT',
          `Timed out waiting for lifecycle snapshot after ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);
    cleanupFns.push(() => {
      clearTimeout(timeout);
    });

    if (options.signal) {
      const onAbort = () => {
        settle(
          'reject',
          new SautiError(
            'MATRIX_LIFECYCLE_WAIT_TIMEOUT',
            'Waiting for lifecycle snapshot was aborted.',
          ),
        );
      };

      if (options.signal.aborted) {
        onAbort();
        return;
      }

      options.signal.addEventListener('abort', onAbort, {once: true});
      cleanupFns.push(() => {
        options.signal?.removeEventListener('abort', onAbort);
      });
    }
  });
}
