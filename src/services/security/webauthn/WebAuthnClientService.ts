/**
 * BIOAZÚCAR 4.0 — WEBAUTHN / FIDO2 CLIENT SERVICE (BROWSER / SCADA CONSOLE)
 * ==============================================================================
 * Conforms to W3C Web Authentication Level 2/3, FIDO2 CTAP 2.1, and IEC 62443 SL3.
 * 
 * Interacts directly with browser navigator.credentials API.
 * Guarantees zero credential persistence in localStorage (uses sessionStorage & IndexedDB Vault).
 */

import {
  WebAuthnChallenge,
  WebAuthnCredentialRecord,
  PhysicalOperatorSession,
  WebAuthnRegistrationPayload,
  WebAuthnAuthenticationPayload,
  EmergencyBreakGlassRequest,
  EmergencyBreakGlassAudit,
} from "../../../types/webauthn";
import { bufferToBase64Url, base64UrlToBuffer } from "./WebAuthnParser";
import { industrialIndexedDbVault } from "../../storage/IndustrialIndexedDbVault";

const WEBAUTHN_SESSION_KEY = "bioazucar_fido2_physical_session";

export class WebAuthnClientService {
  private static instance: WebAuthnClientService | null = null;
  private currentSession: PhysicalOperatorSession | null = null;

  private constructor() {
    this.hydrateSessionFromStorage();
  }

  public static getInstance(): WebAuthnClientService {
    if (!WebAuthnClientService.instance) {
      WebAuthnClientService.instance = new WebAuthnClientService();
    }
    return WebAuthnClientService.instance;
  }

  /**
   * Checks if WebAuthn / FIDO2 is supported by the current browser environment.
   */
  public isWebAuthnSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.PublicKeyCredential !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.credentials !== "undefined"
    );
  }

  /**
   * Checks if an external roaming hardware key (YubiKey) or platform authenticator is available.
   */
  public async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isWebAuthnSupported()) return false;
    try {
      if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
    } catch {
      return false;
    }
    return false;
  }

  /**
   * Registers a new physical hardware key (YubiKey 5) via browser WebAuthn API.
   */
  public async registerHardwareKey(params: {
    userUid: string;
    userEmail: string;
    deviceName: string;
  }): Promise<{ success: boolean; credential: WebAuthnCredentialRecord }> {
    // 1. Request registration challenge from server
    const challengeRes = await fetch("/api/auth/webauthn/register-challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userUid: params.userUid,
        userEmail: params.userEmail,
      }),
    });

    if (!challengeRes.ok) {
      const err = await challengeRes.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${challengeRes.status}: Failed to get registration challenge.`);
    }

    const challenge: WebAuthnChallenge = await challengeRes.json();

    // 2. Perform WebAuthn ceremony with hardware key
    if (!this.isWebAuthnSupported()) {
      throw new Error("WebAuthn API is not supported in this browser environment.");
    }

    const challengeBuffer = base64UrlToBuffer(challenge.challenge);
    const userHandleBuffer = new TextEncoder().encode(params.userUid);

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge: challengeBuffer.buffer as ArrayBuffer,
      rp: {
        name: "BioAzúcar 4.0 Industrial SCADA",
        id: window.location.hostname === "localhost" ? "localhost" : window.location.hostname,
      },
      user: {
        id: userHandleBuffer.buffer as ArrayBuffer,
        name: params.userEmail,
        displayName: params.userEmail,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256 (P-256)
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        userVerification: "preferred",
      },
      timeout: 60000, // 60s timeout for user to insert and touch YubiKey
      attestation: "direct",
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      throw new Error("No credential was created by the hardware authenticator.");
    }

    const rawResponse = credential.response as AuthenticatorAttestationResponse;
    const clientDataJSON = bufferToBase64Url(new Uint8Array(rawResponse.clientDataJSON));
    const attestationObject = bufferToBase64Url(new Uint8Array(rawResponse.attestationObject));
    const credentialId = bufferToBase64Url(new Uint8Array(credential.rawId));

    // 3. Send to server for cryptographic attestation verification
    const payload: WebAuthnRegistrationPayload = {
      challengeId: challenge.challengeId,
      credentialId,
      clientDataJSON,
      attestationObject,
      transports: ["usb", "nfc"],
      deviceName: params.deviceName,
    };

    const verifyRes = await fetch("/api/auth/webauthn/register-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${verifyRes.status}: Registration verification failed.`);
    }

    const result = await verifyRes.json();
    return result;
  }

  /**
   * Authenticates operator with physical YubiKey (requires touching gold contact).
   */
  public async authenticateWithHardwareKey(params: {
    userEmail: string;
  }): Promise<{ success: boolean; session: PhysicalOperatorSession }> {
    // 1. Request authentication challenge
    const challengeRes = await fetch("/api/auth/webauthn/login-challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail: params.userEmail }),
    });

    if (!challengeRes.ok) {
      const err = await challengeRes.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${challengeRes.status}: Failed to get login challenge.`);
    }

    const challenge: WebAuthnChallenge = await challengeRes.json();

    if (!this.isWebAuthnSupported()) {
      throw new Error("WebAuthn API is not supported in this browser environment.");
    }

    const challengeBuffer = base64UrlToBuffer(challenge.challenge);

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge: challengeBuffer.buffer as ArrayBuffer,
      rpId: window.location.hostname === "localhost" ? "localhost" : window.location.hostname,
      userVerification: "preferred",
      timeout: 60000,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      throw new Error("User cancelled hardware touch verification or key was removed.");
    }

    const rawResponse = assertion.response as AuthenticatorAssertionResponse;
    const clientDataJSON = bufferToBase64Url(new Uint8Array(rawResponse.clientDataJSON));
    const authenticatorData = bufferToBase64Url(new Uint8Array(rawResponse.authenticatorData));
    const signature = bufferToBase64Url(new Uint8Array(rawResponse.signature));
    const credentialId = bufferToBase64Url(new Uint8Array(assertion.rawId));

    const payload: WebAuthnAuthenticationPayload = {
      challengeId: challenge.challengeId,
      credentialId,
      clientDataJSON,
      authenticatorData,
      signature,
    };

    // 2. Verify with server
    const verifyRes = await fetch("/api/auth/webauthn/login-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${verifyRes.status}: Authentication failed.`);
    }

    const result = await verifyRes.json();
    this.saveSession(result.session);
    return result;
  }

  /**
   * Executes emergency break-glass plant override.
   */
  public async executeEmergencyBreakGlass(
    request: EmergencyBreakGlassRequest
  ): Promise<{ success: boolean; session: PhysicalOperatorSession; audit: EmergencyBreakGlassAudit }> {
    const res = await fetch("/api/auth/webauthn/emergency-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}: Emergency break-glass failed.`);
    }

    const result = await res.json();
    this.saveSession(result.session);
    return result;
  }

  /**
   * Retrieves enrolled credentials for current user.
   */
  public async fetchEnrolledCredentials(userUid?: string): Promise<WebAuthnCredentialRecord[]> {
    const url = userUid ? `/api/auth/webauthn/credentials?userUid=${encodeURIComponent(userUid)}` : "/api/auth/webauthn/credentials";
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.credentials || [];
  }

  /**
   * Revokes a hardware token.
   */
  public async revokeCredential(credentialId: string): Promise<boolean> {
    const res = await fetch(`/api/auth/webauthn/credentials/${encodeURIComponent(credentialId)}`, {
      method: "DELETE",
    });
    return res.ok;
  }

  public getSession(): PhysicalOperatorSession | null {
    if (!this.currentSession) return null;
    if (new Date(this.currentSession.expiresAt).getTime() < Date.now()) {
      this.clearSession();
      return null;
    }
    return this.currentSession;
  }

  public isSL3Certified(): boolean {
    const session = this.getSession();
    return Boolean(session && session.sl3Certified && session.userPresent);
  }

  public clearSession(): void {
    this.currentSession = null;
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem(WEBAUTHN_SESSION_KEY);
    }
    industrialIndexedDbVault.removeItem("auth_session", WEBAUTHN_SESSION_KEY).catch(() => {});
  }

  private saveSession(session: PhysicalOperatorSession): void {
    this.currentSession = session;
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(WEBAUTHN_SESSION_KEY, JSON.stringify(session));
    }
    // Also mirror into IndexedDB Vault tier 2
    industrialIndexedDbVault.setItem("auth_session", WEBAUTHN_SESSION_KEY, session, "TOKENS").catch(() => {});
  }

  private hydrateSessionFromStorage(): void {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    try {
      const raw = window.sessionStorage.getItem(WEBAUTHN_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.sessionId && new Date(parsed.expiresAt).getTime() > Date.now()) {
          this.currentSession = parsed;
        }
      }
    } catch {
      this.currentSession = null;
    }
  }
}

export const webAuthnClientService = WebAuthnClientService.getInstance();
