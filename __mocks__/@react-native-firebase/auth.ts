const mockGetIdToken = jest.fn(async () => 'mock-firebase-id-token');
const mockConfirm = jest.fn(async () => ({user: {uid: 'firebase-uid-1', getIdToken: mockGetIdToken}}));
const mockSignInWithPhoneNumber = jest.fn(async () => ({
  verificationId: 'mock-verification-id',
  confirm: mockConfirm,
}));
const mockSignOut = jest.fn(async () => undefined);

const mockAuthInstance = {
  signOut: mockSignOut,
};

const getAuth = jest.fn(() => mockAuthInstance);
const signInWithPhoneNumber = mockSignInWithPhoneNumber;

export {getAuth, signInWithPhoneNumber, mockSignInWithPhoneNumber, mockConfirm, mockSignOut, mockGetIdToken};
