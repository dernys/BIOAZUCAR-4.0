/**
 * BIOAZÚCAR 4.0 — WEBAUTHN / FIDO2 PHYSICAL SECURITY DATA CONTRACTS
 * ==============================================================================
 * Conforms to IEC 62443-4-2 FR1 (Human User Identification & Authentication SL3),
 * IEC 62443-4-2 FR2 (Use Control & Enforcement of Multifactor Hardware Keys),
 * W3C Web Authentication Level 2/3 (WebAuthn), and FIDO Alliance CTAP 2.1.
 */

export type WebAuthnTransport = "usb" | "nfc" | "ble" | "internal" | "hybrid";

export type WebAuthnCredentialStatus = "ACTIVE" | "REVOKED" | "SUSPENDED";

export type WebAuthnAlgorithm = -7 | -257 | -8; // -7: ES256 (P-256), -257: RS256, -8: EdDSA (Ed25519)

/**
 * Persisted record of an enrolled physical hardware token (e.g. YubiKey 5 Series).
 */
export interface WebAuthnCredentialRecord {
  id: string; // Base64URL-encoded credential ID
  userUid: string;
  userEmail: string;
  deviceName: string; // e.g. "YubiKey 5 NFC (Sala Control Molino 1)"
  publicKey: string; // Base64URL-encoded raw SPKI or PEM public key
  publicKeyAlgorithm: WebAuthnAlgorithm;
  signCount: number; // Monotonically increasing signature counter (Anti-Cloning Guard)
  transports: WebAuthnTransport[];
  aaguid: string; // Authenticator Attestation GUID
  createdAt: string;
  lastUsedAt: string;
  status: WebAuthnCredentialStatus;
  attestationFormat: string; // "packed" | "fido-u2f" | "none"
  userVerified: boolean; // Hardware PIN or biometric was validated by authenticator
}

/**
 * Cryptographic challenge issued by the server for registration or authentication ceremonies.
 */
export interface WebAuthnChallenge {
  challengeId: string;
  challenge: string; // Base64URL 32-byte cryptographic nonce
  userUid: string;
  userEmail: string;
  type: "REGISTRATION" | "AUTHENTICATION";
  rpId: string; // Relying Party ID (domain / hostname)
  origin: string; // Expected Origin (https://... or http://localhost)
  expiresAt: number; // Epoch ms (300s TTL)
  userVerification: "required" | "preferred" | "discouraged";
}

/**
 * Client payload sent to server to complete hardware token registration.
 */
export interface WebAuthnRegistrationPayload {
  challengeId: string;
  credentialId: string;
  clientDataJSON: string; // Base64URL encoded client data JSON
  attestationObject: string; // Base64URL encoded CBOR attestation object
  transports?: WebAuthnTransport[];
  deviceName: string;
}

/**
 * Client payload sent to server to complete hardware token assertion / authentication.
 */
export interface WebAuthnAuthenticationPayload {
  challengeId: string;
  credentialId: string;
  clientDataJSON: string; // Base64URL encoded client data JSON
  authenticatorData: string; // Base64URL encoded raw authenticator data
  signature: string; // Base64URL encoded ECDSA / RSA signature
  userHandle?: string;
}

/**
 * Authenticated physical operator session certifying IEC 62443 SL3 hardware presence.
 */
export interface PhysicalOperatorSession {
  sessionId: string;
  userUid: string;
  email: string;
  role: string;
  credentialId: string;
  deviceName: string;
  userPresent: boolean; // Physical gold contact touched on YubiKey (UP flag = 1)
  userVerified: boolean; // PIN / biometric verified on YubiKey (UV flag = 1)
  sl3Certified: boolean;
  issuedAt: string;
  expiresAt: string;
  authMethod: "WEBAUTHN_FIDO2_HARDWARE" | "EMERGENCY_BREAK_GLASS_DUAL_SUPERVISOR";
}

/**
 * Request for emergency break-glass plant override when hardware key is lost or damaged.
 * Requires 2 distinct supervisors to authorize according to the 4-eyes principle.
 */
export interface EmergencyBreakGlassRequest {
  targetUserUid: string;
  supervisorAEmail: string;
  supervisorAPin: string;
  supervisorBEmail: string;
  supervisorBPin: string;
  reason: string;
  durationMinutes: number;
  plantZone: string; // e.g. "PATIO_CANAS" | "MOLIENDA_TANDEM1" | "CALDERAS_BAGAZO" | "DCS_CENTRAL"
}

/**
 * Immutable audit certificate of emergency break-glass override.
 */
export interface EmergencyBreakGlassAudit {
  overrideId: string;
  timestamp: string;
  targetUserUid: string;
  supervisorAEmail: string;
  supervisorBEmail: string;
  reason: string;
  plantZone: string;
  durationMinutes: number;
  expiresAt: string;
  tamperSealSha256: string;
  active: boolean;
}

/**
 * Parsed Authenticator Data flags according to W3C WebAuthn Section 6.1.
 */
export interface AuthenticatorDataFlags {
  userPresent: boolean; // Bit 0: UP (User Present)
  userVerified: boolean; // Bit 2: UV (User Verified)
  backupEligibility: boolean; // Bit 3: BE
  backupState: boolean; // Bit 4: BS
  attestedCredentialData: boolean; // Bit 6: AT
  extensionDataIncluded: boolean; // Bit 7: ED
}
