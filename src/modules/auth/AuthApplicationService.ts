import {SautiError} from '../../core/matrix/MatrixClient';

import {
  AuthBootstrapOptions,
  AuthBootstrapResult,
  AuthBootstrapService,
  MatrixRegistrationRequest,
  SessionBootstrapResult,
} from './api';

interface AuthBootstrapPort {
  registerAndBootstrap(
    request: MatrixRegistrationRequest,
    options?: AuthBootstrapOptions,
  ): Promise<AuthBootstrapResult>;
  bootstrapFromStoredSession(
    options?: AuthBootstrapOptions,
  ): Promise<SessionBootstrapResult>;
}

export class AuthApplicationService {
  constructor(
    private readonly bootstrapService: AuthBootstrapPort = new AuthBootstrapService(),
  ) {}

  async registerAndBootstrap(
    request: MatrixRegistrationRequest,
    options: AuthBootstrapOptions = {},
  ): Promise<AuthBootstrapResult> {
    try {
      return await this.bootstrapService.registerAndBootstrap(request, options);
    } catch (error) {
      if (error instanceof SautiError) {
        throw error;
      }

      throw new SautiError(
        'AUTH_BOOTSTRAP_FAILED',
        'Register-and-bootstrap flow failed.',
        error,
      );
    }
  }

  async resumeFromStoredSession(
    options: AuthBootstrapOptions = {},
  ): Promise<SessionBootstrapResult> {
    try {
      return await this.bootstrapService.bootstrapFromStoredSession(options);
    } catch (error) {
      if (error instanceof SautiError) {
        throw error;
      }

      throw new SautiError(
        'AUTH_BOOTSTRAP_FAILED',
        'Stored-session resume flow failed.',
        error,
      );
    }
  }
}
