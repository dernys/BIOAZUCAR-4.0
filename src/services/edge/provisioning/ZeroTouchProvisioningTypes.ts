/**
 * BioAzúcar 4.0 — Zero-Touch Provisioning (ZTP) & X.509 mTLS Types (PRV-02 / P0-05 Extended)
 * 
 * Spec Reference: BIOAZUCAR_MASTER_DEVELOPMENT.md Section 25 & IEC 62443-4-2
 * 
 * Defines the data contracts, cryptosystems and lifecycle states for
 * Zero-Touch Remote Provisioning (ZTP) and X.509 PKI certificate enrollment
 * over Mutual TLS (mTLS) for industrial edge daemons in sugar mills.
 */

import { SignedEdgeManifest, ProvisioningAlgorithm } from "../EdgeProvisioningService";

export type ZtpDeviceStatus =
  | "UNPROVISIONED"
  | "BOOTSTRAPPING"
  | "CSR_SUBMITTED"
  | "CERT_ISSUED"
  | "MTLS_ESTABLISHED"
  | "MANIFEST_APPLIED"
  | "HEALTH_VERIFIED"
  | "COMMISSIONED"
  | "REVOKED"
  | "FAULTED_ROLLBACK";

export interface HardwareIdentity {
  chassisUuid: string;
  serialNumber: string;
  macAddress: string;
  hardwareModel: string;
  cpuArchitecture: "x86_64" | "aarch64" | "armv7l";
  tpmPresent?: boolean;
}

export interface BootstrapToken {
  tokenId: string;
  tokenSecret: string; // High-entropy one-time secret
  tenantId: string;
  siteId: string;
  gatewayId: string;
  issuedAt: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
  usedByHardwareId?: string;
  allowedSubnets?: string[];
}

export interface SubjectDistinguishedName {
  commonName: string; // CN: e.g. edge-central01.bioazucar.internal
  organization: string; // O: e.g. BioAzucar Central Azucarero
  organizationalUnit: string; // OU: e.g. Industrial Edge Fleet
  country: string; // C: e.g. VE
  stateOrProvince?: string; // ST: e.g. Portuguesa
  locality?: string; // L: e.g. Acarigua
}

export interface SubjectAlternativeNames {
  dnsNames?: string[];
  ipAddresses?: string[];
}

export interface CertificateSigningRequest {
  csrPem: string;
  publicKeyPem: string;
  subject: SubjectDistinguishedName;
  san?: SubjectAlternativeNames;
  algorithm: ProvisioningAlgorithm;
  hardwareIdentity: HardwareIdentity;
  bootstrapTokenId: string;
  bootstrapTokenProof: string; // HMAC-SHA256(bootstrapSecret, hardwareIdentity + nonce)
  nonce: string;
  timestamp: string;
}

export interface X509CertificateMetadata {
  serialNumber: string;
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  fingerprintSha256: string;
  keyUsage: string[];
  extendedKeyUsage: string[];
  isCa: boolean;
  revoked: boolean;
  revokedAt?: string;
  revocationReason?: string;
}

export interface IssuedCertificateBundle {
  certificatePem: string;
  intermediateCaPem?: string;
  rootCaPem: string;
  metadata: X509CertificateMetadata;
}

export interface PreRegisteredDevice {
  gatewayId: string;
  tenantId: string;
  siteId: string;
  expectedChassisUuid?: string;
  expectedMacAddress?: string;
  expectedSerialNumber?: string;
  assignedRuntimeProfile: "SIMULATION" | "LAB" | "PRODUCTION";
  registeredAt: string;
  registeredBy: string;
  status: ZtpDeviceStatus;
  activeCertificateFingerprint?: string;
  lastSeenAt?: string;
  ipAddress?: string;
}

export interface MtlsVerificationRequest {
  clientCertificatePem: string;
  serverCertificatePem: string;
  tlsVersion: "TLSv1.2" | "TLSv1.3";
  cipherSuite: string;
  clientIp?: string;
  clientNonce: string;
  serverNonce: string;
  clientSignatureProof: string; // Signature of (serverNonce + clientNonce) with client private key
}

export interface MtlsVerificationResponse {
  authenticated: boolean;
  status: "ESTABLISHED" | "REJECTED_UNTRUSTED_CLIENT" | "REJECTED_REVOKED" | "REJECTED_EXPIRED" | "REJECTED_TARGET_MISMATCH";
  gatewayId?: string;
  tenantId?: string;
  siteId?: string;
  clientFingerprint?: string;
  error?: string;
}

export interface ZtpProvisioningResponse {
  success: boolean;
  deviceStatus: ZtpDeviceStatus;
  gatewayId: string;
  certificateBundle?: IssuedCertificateBundle;
  initialManifest?: SignedEdgeManifest;
  mtlsSessionToken?: string;
  error?: string;
  errorCode?: string;
}
