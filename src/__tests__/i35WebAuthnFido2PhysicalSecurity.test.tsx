import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  WebAuthnServerService,
  WebAuthnSecurityError,
} from "../services/security/webauthn/WebAuthnServerService";
import {
  bufferToBase64Url,
  base64UrlToBuffer,
  parseClientDataJson,
  parseAuthenticatorData,
  verifyRpIdHash,
  verifyOrigin,
} from "../services/security/webauthn/WebAuthnParser";
import { WebAuthnControlRoomModal } from "../components/security/WebAuthnControlRoomModal";
import { sha256Hex, sha256Bytes, randomBytes, createHash } from "../utils/cryptoUtils";
import { assertStorageTierPermitted } from "../services/storage/IndustrialIndexedDbVault";

describe("Iteration I35: [P1-03] WebAuthn / FIDO2 Physical Security & Hardware MFA (IEC 62443-4-2 SL3)", () => {
  let serverService: WebAuthnServerService;

  beforeEach(() => {
    serverService = WebAuthnServerService.getInstance();
    serverService.resetForTesting();
    serverService.configureRelyingParty("localhost", "http://localhost:3000");
  });

  afterEach(() => {
    serverService.resetForTesting();
    vi.restoreAllMocks();
  });

  describe("1. Cryptographic Challenge Generation & Nonce Entropy", () => {
    it("should generate a 32-byte cryptographically secure random challenge with 300s TTL", () => {
      const challenge = serverService.generateChallenge({
        userUid: "usr-op-01",
        userEmail: "operador@bioazucar.com",
        type: "AUTHENTICATION",
      });

      expect(challenge.challengeId).toMatch(/^chal-\d+-[0-9a-f]{8}$/);
      expect(challenge.challenge).toBeDefined();

      const decodedBuffer = base64UrlToBuffer(challenge.challenge);
      expect(decodedBuffer.length).toBe(32); // 256 bits of entropy

      expect(challenge.userUid).toBe("usr-op-01");
      expect(challenge.userEmail).toBe("operador@bioazucar.com");
      expect(challenge.rpId).toBe("localhost");
      expect(challenge.expiresAt).toBeGreaterThan(Date.now() + 290000);
      expect(challenge.expiresAt).toBeLessThanOrEqual(Date.now() + 300000);
    });

    it("should guarantee unique nonces across successive challenge requests", () => {
      const c1 = serverService.generateChallenge({
        userUid: "usr-op-01",
        userEmail: "operador@bioazucar.com",
        type: "REGISTRATION",
      });
      const c2 = serverService.generateChallenge({
        userUid: "usr-op-01",
        userEmail: "operador@bioazucar.com",
        type: "REGISTRATION",
      });

      expect(c1.challengeId).not.toBe(c2.challengeId);
      expect(c1.challenge).not.toBe(c2.challenge);
    });
  });

  describe("2. Binary AuthenticatorData & ClientDataJSON Parser", () => {
    it("should parse ClientDataJSON and validate ceremony type, challenge and origin", () => {
      const clientDataObj = {
        type: "webauthn.get",
        challenge: "TEST_NONCE_BASE64_URL_12345",
        origin: "http://localhost:3000",
        crossOrigin: false,
      };
      const rawJson = JSON.stringify(clientDataObj);
      const parsed = parseClientDataJson(rawJson);

      expect(parsed.type).toBe("webauthn.get");
      expect(parsed.challenge).toBe("TEST_NONCE_BASE64_URL_12345");
      expect(parsed.origin).toBe("http://localhost:3000");

      // Verify origin checker
      expect(verifyOrigin(parsed.origin, "localhost")).toBe(true);
      expect(verifyOrigin("https://malicious-attacker.com", "localhost")).toBe(false);
    });

    it("should parse binary AuthenticatorData with UP (bit 0), UV (bit 2), signCount and RP ID hash", () => {
      // Build synthetic 37-byte authenticator data
      const rpId = "localhost";
      const expectedRpIdHash = sha256Bytes(new TextEncoder().encode(rpId));

      const authData = new Uint8Array(37);
      // Bytes 0..31: RP ID Hash
      authData.set(expectedRpIdHash, 0);
      // Byte 32: Flags (UP=1 -> 0x01, UV=1 -> 0x04 => 0x05)
      authData[32] = 0x05;
      // Bytes 33..36: Sign count (big-endian 32-bit = 1050)
      authData[33] = 0x00;
      authData[34] = 0x00;
      authData[35] = 0x04;
      authData[36] = 0x1a; // 1050

      const parsed = parseAuthenticatorData(authData);

      expect(parsed.flags.userPresent).toBe(true);
      expect(parsed.flags.userVerified).toBe(true);
      expect(parsed.flags.attestedCredentialData).toBe(false);
      expect(parsed.signCount).toBe(1050);

      // Verify RP ID Hash matches expected
      expect(verifyRpIdHash(parsed, "localhost")).toBe(true);
      expect(verifyRpIdHash(parsed, "other-domain.com")).toBe(false);
    });
  });

  describe("3. Hardware Token Registration Ceremony", () => {
    it("should enroll a new physical YubiKey 5 hardware key with verified challenge", () => {
      const challenge = serverService.generateChallenge({
        userUid: "usr-supervisor-01",
        userEmail: "supervisor@bioazucar.com",
        type: "REGISTRATION",
      });

      const clientDataJSON = JSON.stringify({
        type: "webauthn.create",
        challenge: challenge.challenge,
        origin: "http://localhost:3000",
      });

      const credId = "YUBIKEY_HARDWARE_KEY_SERIAL_998877";

      const res = serverService.verifyRegistration({
        challengeId: challenge.challengeId,
        credentialId: credId,
        clientDataJSON: bufferToBase64Url(new TextEncoder().encode(clientDataJSON)),
        attestationObject: bufferToBase64Url(randomBytes(64)),
        deviceName: "YubiKey 5 NFC — Consola Calderas",
        transports: ["usb", "nfc"],
      });

      expect(res.success).toBe(true);
      expect(res.credential.id).toBe(credId);
      expect(res.credential.userEmail).toBe("supervisor@bioazucar.com");
      expect(res.credential.status).toBe("ACTIVE");
      expect(res.credential.signCount).toBe(0);

      // Verify query
      const userKeys = serverService.getEnrolledCredentials("usr-supervisor-01");
      expect(userKeys).toHaveLength(1);
      expect(userKeys[0].id).toBe(credId);
    });

    it("should reject registration if challenge has expired (>300s)", () => {
      const challenge = serverService.generateChallenge({
        userUid: "usr-op-01",
        userEmail: "operador@bioazucar.com",
        type: "REGISTRATION",
      });

      // Advance clock past expiration
      challenge.expiresAt = Date.now() - 1000;

      const clientDataJSON = JSON.stringify({
        type: "webauthn.create",
        challenge: challenge.challenge,
        origin: "http://localhost:3000",
      });

      expect(() => {
        serverService.verifyRegistration({
          challengeId: challenge.challengeId,
          credentialId: "KEY_FAIL_01",
          clientDataJSON: bufferToBase64Url(new TextEncoder().encode(clientDataJSON)),
          attestationObject: bufferToBase64Url(randomBytes(64)),
          deviceName: "Expired Key",
        });
      }).toThrowError(/expired/i);
    });

    it("should reject registration if challenge nonce does not match (Replay Attack)", () => {
      const challenge = serverService.generateChallenge({
        userUid: "usr-op-01",
        userEmail: "operador@bioazucar.com",
        type: "REGISTRATION",
      });

      const fakeClientData = JSON.stringify({
        type: "webauthn.create",
        challenge: "FAKE_OR_REPLAYED_NONCE_VALUE",
        origin: "http://localhost:3000",
      });

      expect(() => {
        serverService.verifyRegistration({
          challengeId: challenge.challengeId,
          credentialId: "KEY_FAIL_02",
          clientDataJSON: bufferToBase64Url(new TextEncoder().encode(fakeClientData)),
          attestationObject: bufferToBase64Url(randomBytes(64)),
          deviceName: "Replayed Key",
        });
      }).toThrowError(/CHALLENGE_MISMATCH/);
    });
  });

  describe("4. Authentication Assertion Ceremony & Anti-Cloning Protection", () => {
    it("should authenticate operator when physical presence (UP=1) and valid counter are provided", () => {
      // Enroll key
      const regChallenge = serverService.generateChallenge({
        userUid: "usr-op-01",
        userEmail: "operador@bioazucar.com",
        type: "REGISTRATION",
      });
      const credId = "YUBIKEY_OP_KEY_TEST_01";
      serverService.verifyRegistration({
        challengeId: regChallenge.challengeId,
        credentialId: credId,
        clientDataJSON: bufferToBase64Url(
          new TextEncoder().encode(
            JSON.stringify({
              type: "webauthn.create",
              challenge: regChallenge.challenge,
              origin: "http://localhost:3000",
            })
          )
        ),
        attestationObject: bufferToBase64Url(randomBytes(64)),
        deviceName: "YubiKey 5 Series — Molino 1",
      });

      // Request Login Challenge
      const loginChallenge = serverService.generateChallenge({
        userUid: "usr-op-01",
        userEmail: "operador@bioazucar.com",
        type: "AUTHENTICATION",
      });

      // Construct AuthenticatorData with UP=1 and signCount=1
      const authData = new Uint8Array(37);
      authData.set(sha256Bytes(new TextEncoder().encode("localhost")), 0);
      authData[32] = 0x01; // UP = 1
      authData[36] = 0x01; // signCount = 1

      const loginRes = serverService.verifyAuthentication({
        challengeId: loginChallenge.challengeId,
        credentialId: credId,
        clientDataJSON: bufferToBase64Url(
          new TextEncoder().encode(
            JSON.stringify({
              type: "webauthn.get",
              challenge: loginChallenge.challenge,
              origin: "http://localhost:3000",
            })
          )
        ),
        authenticatorData: bufferToBase64Url(authData),
        signature: bufferToBase64Url(randomBytes(64)),
      });

      expect(loginRes.success).toBe(true);
      expect(loginRes.session.userPresent).toBe(true);
      expect(loginRes.session.sl3Certified).toBe(true);
      expect(loginRes.session.deviceName).toContain("YubiKey 5 Series");
      expect(loginRes.session.authMethod).toBe("WEBAUTHN_FIDO2_HARDWARE");
    });

    it("should fail closed if User Present (UP bit) is 0 (Simulated or automated replay without touch)", () => {
      const regChallenge = serverService.generateChallenge({
        userUid: "usr-op-01",
        userEmail: "operador@bioazucar.com",
        type: "REGISTRATION",
      });
      const credId = "YUBIKEY_NO_TOUCH_01";
      serverService.verifyRegistration({
        challengeId: regChallenge.challengeId,
        credentialId: credId,
        clientDataJSON: bufferToBase64Url(
          new TextEncoder().encode(
            JSON.stringify({
              type: "webauthn.create",
              challenge: regChallenge.challenge,
              origin: "http://localhost:3000",
            })
          )
        ),
        attestationObject: bufferToBase64Url(randomBytes(64)),
        deviceName: "No Touch Key",
      });

      const loginChallenge = serverService.generateChallenge({
        userUid: "usr-op-01",
        userEmail: "operador@bioazucar.com",
        type: "AUTHENTICATION",
      });

      // Construct AuthenticatorData with UP = 0 (Bit 0 cleared!)
      const authData = new Uint8Array(37);
      authData.set(sha256Bytes(new TextEncoder().encode("localhost")), 0);
      authData[32] = 0x00; // UP = 0 !
      authData[36] = 0x05;

      expect(() => {
        serverService.verifyAuthentication({
          challengeId: loginChallenge.challengeId,
          credentialId: credId,
          clientDataJSON: bufferToBase64Url(
            new TextEncoder().encode(
              JSON.stringify({
                type: "webauthn.get",
                challenge: loginChallenge.challenge,
                origin: "http://localhost:3000",
              })
            )
          ),
          authenticatorData: bufferToBase64Url(authData),
          signature: bufferToBase64Url(randomBytes(64)),
        });
      }).toThrowError(/USER_NOT_PRESENT/);
    });

    it("should detect Cloned Authenticator attack when signature counter regresses (signCount <= stored)", () => {
      const credId = "YUBIKEY_CLONE_TEST_KEY";
      const regChallenge = serverService.generateChallenge({
        userUid: "usr-op-01",
        userEmail: "operador@bioazucar.com",
        type: "REGISTRATION",
      });
      serverService.verifyRegistration({
        challengeId: regChallenge.challengeId,
        credentialId: credId,
        clientDataJSON: bufferToBase64Url(
          new TextEncoder().encode(
            JSON.stringify({
              type: "webauthn.create",
              challenge: regChallenge.challenge,
              origin: "http://localhost:3000",
            })
          )
        ),
        attestationObject: bufferToBase64Url(randomBytes(64)),
        deviceName: "YubiKey Clone Target",
      });

      // Legitimate authentication with counter = 50
      const c1 = serverService.generateChallenge({
        userUid: "usr-op-01",
        userEmail: "operador@bioazucar.com",
        type: "AUTHENTICATION",
      });
      const authData1 = new Uint8Array(37);
      authData1.set(sha256Bytes(new TextEncoder().encode("localhost")), 0);
      authData1[32] = 0x01;
      authData1[36] = 50; // counter = 50
      serverService.verifyAuthentication({
        challengeId: c1.challengeId,
        credentialId: credId,
        clientDataJSON: bufferToBase64Url(
          new TextEncoder().encode(
            JSON.stringify({
              type: "webauthn.get",
              challenge: c1.challenge,
              origin: "http://localhost:3000",
            })
          )
        ),
        authenticatorData: bufferToBase64Url(authData1),
        signature: bufferToBase64Url(randomBytes(64)),
      });

      // Attack: Cloned key attempts login with counter = 40 (regression!)
      const c2 = serverService.generateChallenge({
        userUid: "usr-op-01",
        userEmail: "operador@bioazucar.com",
        type: "AUTHENTICATION",
      });
      const authDataClone = new Uint8Array(37);
      authDataClone.set(sha256Bytes(new TextEncoder().encode("localhost")), 0);
      authDataClone[32] = 0x01;
      authDataClone[36] = 40; // counter = 40 <= 50

      expect(() => {
        serverService.verifyAuthentication({
          challengeId: c2.challengeId,
          credentialId: credId,
          clientDataJSON: bufferToBase64Url(
            new TextEncoder().encode(
              JSON.stringify({
                type: "webauthn.get",
                challenge: c2.challenge,
                origin: "http://localhost:3000",
              })
            )
          ),
          authenticatorData: bufferToBase64Url(authDataClone),
          signature: bufferToBase64Url(randomBytes(64)),
        });
      }).toThrowError(/CLONED_AUTHENTICATOR_DETECTED/);

      // Verify key was suspended
      const keyRecord = serverService.getEnrolledCredentials().find((k) => k.id === credId);
      expect(keyRecord?.status).toBe("SUSPENDED");
    });
  });

  describe("5. Emergency Break-Glass Plant Override Protocol (IEC 62443-2-1)", () => {
    it("should allow dual-supervisor 4-eyes authorization and generate SHA-256 tamper-evident seal", () => {
      const res = serverService.executeEmergencyBreakGlass({
        targetUserUid: "usr-op-01",
        supervisorAEmail: "supervisor1@bioazucar.com",
        supervisorAPin: "9988",
        supervisorBEmail: "admin@bioazucar.com",
        supervisorBPin: "7766",
        plantZone: "MOLIENDA_TANDEM1",
        reason: "Falla física de lector USB en panel DCS durante parada no programada de molino #1",
        durationMinutes: 60,
      });

      expect(res.success).toBe(true);
      expect(res.session.authMethod).toBe("EMERGENCY_BREAK_GLASS_DUAL_SUPERVISOR");
      expect(res.session.sl3Certified).toBe(false); // Flagged: SL3 suspended during emergency
      expect(res.audit.overrideId).toMatch(/^BG-\d+-[0-9A-F]{8}$/);
      expect(res.audit.tamperSealSha256).toHaveLength(64);
      expect(res.audit.supervisorAEmail).toBe("supervisor1@bioazucar.com");
      expect(res.audit.supervisorBEmail).toBe("admin@bioazucar.com");

      // Verify audit is recorded
      const audits = serverService.getEmergencyAudits();
      expect(audits).toHaveLength(1);
      expect(audits[0].overrideId).toBe(res.audit.overrideId);
    });

    it("should reject break-glass if Supervisor A and Supervisor B are the same person", () => {
      expect(() => {
        serverService.executeEmergencyBreakGlass({
          targetUserUid: "usr-op-01",
          supervisorAEmail: "supervisor@bioazucar.com",
          supervisorAPin: "1234",
          supervisorBEmail: "supervisor@bioazucar.com", // COLLISION!
          supervisorBPin: "1234",
          plantZone: "DCS_CENTRAL",
          reason: "Intento de sobremarcha con un solo supervisor.",
          durationMinutes: 30,
        });
      }).toThrowError(/SUPERVISOR_IDENTITY_COLLISION/);
    });

    it("should reject break-glass without sufficient technical justification (>=10 chars)", () => {
      expect(() => {
        serverService.executeEmergencyBreakGlass({
          targetUserUid: "usr-op-01",
          supervisorAEmail: "sup1@bioazucar.com",
          supervisorAPin: "1234",
          supervisorBEmail: "sup2@bioazucar.com",
          supervisorBPin: "5678",
          plantZone: "DCS_CENTRAL",
          reason: "Emerg", // Too short
          durationMinutes: 30,
        });
      }).toThrowError(/JUSTIFICATION_REQUIRED/);
    });
  });

  describe("6. Storage Governance & Prohibited Storage Assertions", () => {
    it("should strictly prohibit storing WebAuthn credentials or sessions in localStorage", () => {
      expect(() => {
        assertStorageTierPermitted("CREDENTIALS", "LOCAL_STORAGE_UI_ONLY");
      }).toThrowError(/LOCAL_DATA_GOVERNANCE_VIOLATION/);

      expect(() => {
        assertStorageTierPermitted("TOKENS", "LOCAL_STORAGE_UI_ONLY");
      }).toThrowError(/LOCAL_DATA_GOVERNANCE_VIOLATION/);
    });
  });

  describe("7. WebAuthnControlRoomModal React Component Render Test", () => {
    it("should render null when isOpen is false", () => {
      const html = renderToString(
        <WebAuthnControlRoomModal isOpen={false} onClose={() => {}} />
      );
      expect(html).toBe("");
    });

    it("should render full control room console without crash when isOpen is true", () => {
      const html = renderToString(
        <WebAuthnControlRoomModal
          isOpen={true}
          onClose={() => {}}
          currentUserEmail="operador@bioazucar.com"
          currentRole="operador"
        />
      );

      expect(html).toContain("SEGURIDAD INDUSTRIAL IEC 62443-4-2 SL3");
      expect(html).toContain("Autenticación Física WebAuthn / FIDO2");
      expect(html).toContain("1. Verificación YubiKey");
      expect(html).toContain("2. Enrolar Nueva Llave");
      expect(html).toContain("3. Registro de Llaves");
      expect(html).toContain("4. Sobremarcha de Emergencia");
    });
  });
});
