import React from 'react';
import {AuthFlowScreen} from '../modules/auth';

/**
 * Placeholder entry point for the unauthenticated flow.
 * Will be replaced by the real auth navigator (phone + OTP screens).
 */
export function AuthGatewayPlaceholder(): React.JSX.Element {
  return <AuthFlowScreen />;
}
