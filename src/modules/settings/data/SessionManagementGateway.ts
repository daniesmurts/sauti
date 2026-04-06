import {matrixClient, type MatrixDeviceSession} from '../../../core/matrix/MatrixClient';

export interface SessionManagementGateway {
  listSessions(): Promise<MatrixDeviceSession[]>;
  revokeSession(deviceId: string): Promise<void>;
}

class MatrixSessionManagementGateway implements SessionManagementGateway {
  async listSessions(): Promise<MatrixDeviceSession[]> {
    return matrixClient.listDeviceSessions();
  }

  async revokeSession(deviceId: string): Promise<void> {
    await matrixClient.revokeDeviceSession(deviceId);
  }
}

export function createSessionManagementGateway(): SessionManagementGateway {
  return new MatrixSessionManagementGateway();
}
