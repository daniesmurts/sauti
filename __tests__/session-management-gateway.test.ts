import {describe, expect, it, jest} from '@jest/globals';

import {createSessionManagementGateway} from '../src/modules/settings/data/SessionManagementGateway';
import {matrixClient} from '../src/core/matrix/MatrixClient';

describe('SessionManagementGateway', () => {
  it('delegates list and revoke operations to matrix client wrapper', async () => {
    const listSpy = jest
      .spyOn(matrixClient, 'listDeviceSessions')
      .mockResolvedValueOnce([
        {
          deviceId: 'DEVICE_A',
          isCurrent: true,
        },
      ]);
    const revokeSpy = jest
      .spyOn(matrixClient, 'revokeDeviceSession')
      .mockResolvedValueOnce(undefined);

    const gateway = createSessionManagementGateway();

    const sessions = await gateway.listSessions();
    await gateway.revokeSession('DEVICE_A');

    expect(sessions).toEqual([
      {
        deviceId: 'DEVICE_A',
        isCurrent: true,
      },
    ]);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith('DEVICE_A');

    listSpy.mockRestore();
    revokeSpy.mockRestore();
  });
});
