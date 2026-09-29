/**
 * BioAzúcar 4.0 — SuperAdmin Credentials & Production Deployment Lifecycle Service
 * ==============================================================================
 * Conforms to IEC 62443-4-2 SL3 & CIS Benchmark Level 2.
 *
 * Requirements:
 * 1. Development & Test Environments:
 *    - Superadmin password is read and verified from environment variable (SUPERADMIN_PASSWORD / VITE_SUPERADMIN_PASSWORD).
 * 2. Production Environment:
 *    - When deploying to production, the application strictly requires creating or confirming
 *      the Superadmin password upon initial deployment / setup.
 *    - Allows promoting/migrating the validated dev/test password into production, or creating a fresh one.
 *    - Prohibits default or weak credentials; enforces 12+ chars, uppercase, lowercase, numbers, symbols.
 */

import { createHash, randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";

export interface PasswordComplexityResult {
  isValid: boolean;
  errors: string[];
  entropyScore: number;
}

export interface SuperAdminCredentialStatus {
  email: string;
  environment: "PRODUCTION" | "DEVELOPMENT" | "TEST";
  isProduction: boolean;
  hasEnvPassword: boolean;
  isProductionPasswordSet: boolean;
  isPasswordCreationRequired: boolean;
  lastUpdated?: string;
  securityStandard: string;
}

const DEFAULT_BLOCKED_PASSWORDS = [
  "admin",
  "admin123",
  "password",
  "password123",
  "123456",
  "12345678",
  "123456789",
  "bioazucar",
  "bioazucar123",
  "superadmin",
  "root",
  "toor",
];

const SECURITY_STORAGE_PATH = path.resolve(
  process.cwd(),
  "data",
  "security",
  "superadmin_production.json"
);

export class SuperAdminCredentialsService {
  private static instance: SuperAdminCredentialsService | null = null;

  private productionSalt: string | null = null;
  private productionPasswordHash: string | null = null;
  private lastUpdated: string | null = null;

  private constructor() {
    this.loadPersistedProductionCredentials();
  }

  public static getInstance(): SuperAdminCredentialsService {
    if (!SuperAdminCredentialsService.instance) {
      SuperAdminCredentialsService.instance = new SuperAdminCredentialsService();
    }
    return SuperAdminCredentialsService.instance;
  }

  /**
   * Resets singleton for test fixture isolation
   */
  public static resetInstance(): void {
    SuperAdminCredentialsService.instance = null;
  }

  /**
   * Retrieves configured superadmin email from environment (SSOT)
   */
  public getSuperAdminEmail(): string {
    const email =
      (typeof process !== "undefined" && process.env?.SUPERADMIN_EMAIL) ||
      (typeof process !== "undefined" && process.env?.VITE_SUPERADMIN_EMAIL) ||
      "ing.dernys@gmail.com";
    return email.trim().toLowerCase();
  }

  /**
   * Resolves current execution profile
   */
  public getEnvironmentProfile(): "PRODUCTION" | "DEVELOPMENT" | "TEST" {
    const profile =
      process.env.INDUSTRIAL_RUNTIME_PROFILE ||
      process.env.NODE_ENV ||
      "development";

    const normalized = profile.toUpperCase().trim();
    if (normalized === "PRODUCTION" || normalized === "PROD") {
      return "PRODUCTION";
    }
    if (normalized === "TEST" || normalized === "TESTING") {
      return "TEST";
    }
    return "DEVELOPMENT";
  }

  public isProduction(): boolean {
    return this.getEnvironmentProfile() === "PRODUCTION";
  }

  /**
   * Reads password configured in environment variable for DEV / TEST
   */
  public getDevelopmentConfiguredPassword(): string | null {
    const pass =
      (typeof process !== "undefined" && process.env?.SUPERADMIN_PASSWORD) ||
      (typeof process !== "undefined" && process.env?.VITE_SUPERADMIN_PASSWORD) ||
      null;
    return pass ? pass.trim() : null;
  }

  /**
   * Checks if a production superadmin password has been established
   */
  public isProductionPasswordSet(): boolean {
    return Boolean(this.productionPasswordHash && this.productionSalt);
  }

  /**
   * Evaluates if initial password setup is required upon deployment
   */
  public isPasswordCreationRequired(): boolean {
    if (this.isProduction()) {
      return !this.isProductionPasswordSet();
    }
    // In dev/test: only required if no environment variable is provided
    return !this.getDevelopmentConfiguredPassword() && !this.isProductionPasswordSet();
  }

  /**
   * Audits password complexity against IEC 62443-4-2 SR 1.1 / 1.7 standards
   */
  public validatePasswordComplexity(password: string): PasswordComplexityResult {
    const errors: string[] = [];
    if (!password) {
      return { isValid: false, errors: ["La contraseña no puede estar vacía."], entropyScore: 0 };
    }

    if (password.length < 12) {
      errors.push("La contraseña debe tener una longitud mínima de 12 caracteres (IEC 62443-4-2).");
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("La contraseña debe contener al menos una letra mayúscula (A-Z).");
    }

    if (!/[a-z]/.test(password)) {
      errors.push("La contraseña debe contener al menos una letra minúscula (a-z).");
    }

    if (!/[0-9]/.test(password)) {
      errors.push("La contraseña debe contener al menos un dígito numérico (0-9).");
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
      errors.push("La contraseña debe contener al menos un carácter especial o símbolo (!@#$%^&*...).");
    }

    const lower = password.toLowerCase().trim();
    const isPredictablePrefix =
      lower.startsWith("superadmin") ||
      lower.startsWith("admin123") ||
      lower.startsWith("password") ||
      lower.startsWith("root") ||
      lower === "bioazucar" ||
      lower === "bioazucar123";

    if (isPredictablePrefix) {
      errors.push("La contraseña no puede iniciar con términos predeterminados o predecibles ('superadmin', 'admin', 'password').");
    }

    for (const blocked of DEFAULT_BLOCKED_PASSWORDS) {
      if (
        lower === blocked ||
        lower === `${blocked}123` ||
        lower === `${blocked}2026` ||
        lower === `${blocked}!` ||
        lower === `${blocked}!123`
      ) {
        errors.push(`La contraseña no puede ser un término predeterminado o predecible ('${blocked}').`);
        break;
      }
    }

    // Entropy estimation
    let charsetSize = 0;
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 33;

    const entropyScore = Math.round(password.length * (Math.log2(charsetSize || 1)));

    if (entropyScore < 60) {
      errors.push("La entropía criptográfica es insuficiente (< 60 bits). Use una frase o contraseña más compleja.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      entropyScore,
    };
  }

  /**
   * Promotes the development/test environment variable password to production
   */
  public promoteDevPasswordToProduction(): {
    success: boolean;
    message: string;
    errors?: string[];
  } {
    const devPass = this.getDevelopmentConfiguredPassword();
    if (!devPass) {
      return {
        success: false,
        message: "No existe una variable de entorno SUPERADMIN_PASSWORD en el entorno de desarrollo.",
      };
    }

    const validation = this.validatePasswordComplexity(devPass);
    if (!validation.isValid) {
      return {
        success: false,
        message: "La contraseña configurada en desarrollo no cumple los requisitos de seguridad de producción.",
        errors: validation.errors,
      };
    }

    return this.setProductionPassword(devPass);
  }

  /**
   * Establishes or updates the Superadmin password for production
   */
  public setProductionPassword(password: string): {
    success: boolean;
    message: string;
    errors?: string[];
  } {
    const validation = this.validatePasswordComplexity(password);
    if (!validation.isValid) {
      return {
        success: false,
        message: "La contraseña no cumple con los estándares de ciberseguridad IEC 62443.",
        errors: validation.errors,
      };
    }

    const salt = randomBytes(16).toString("hex");
    const hash = this.hashPassword(password, salt);

    this.productionSalt = salt;
    this.productionPasswordHash = hash;
    this.lastUpdated = new Date().toISOString();

    this.persistProductionCredentials();

    return {
      success: true,
      message: "Contraseña de SuperAdmin establecida y sellada exitosamente para producción.",
    };
  }

  /**
   * Verifies credentials for Superadmin authentication
   */
  public verifyCredentials(email: string, password: string): {
    success: boolean;
    reason?: string;
  } {
    const superEmail = this.getSuperAdminEmail();
    if (!email || email.trim().toLowerCase() !== superEmail) {
      return { success: false, reason: "El correo electrónico no corresponde al SuperAdmin autorizado." };
    }

    if (!password) {
      return { success: false, reason: "La contraseña es requerida." };
    }

    // 1. If production password hash is present, check against it
    if (this.productionPasswordHash && this.productionSalt) {
      const computed = this.hashPassword(password, this.productionSalt);
      if (computed === this.productionPasswordHash) {
        return { success: true };
      }
    }

    // 2. In DEV / TEST, allow environment variable password
    if (!this.isProduction()) {
      const devPass = this.getDevelopmentConfiguredPassword();
      if (devPass && password === devPass) {
        return { success: true };
      }
    }

    return { success: false, reason: "Credenciales de SuperAdmin inválidas." };
  }

  /**
   * Gets current status snapshot
   */
  public getStatus(): SuperAdminCredentialStatus {
    return {
      email: this.getSuperAdminEmail(),
      environment: this.getEnvironmentProfile(),
      isProduction: this.isProduction(),
      hasEnvPassword: Boolean(this.getDevelopmentConfiguredPassword()),
      isProductionPasswordSet: this.isProductionPasswordSet(),
      isPasswordCreationRequired: this.isPasswordCreationRequired(),
      lastUpdated: this.lastUpdated || undefined,
      securityStandard: "IEC 62443-4-2 SL3 / CIS Benchmark Level 2",
    };
  }

  private hashPassword(password: string, salt: string): string {
    return createHash("sha256").update(`${salt}:${password}`).digest("hex");
  }

  private persistProductionCredentials(): void {
    try {
      const dir = path.dirname(SECURITY_STORAGE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        email: this.getSuperAdminEmail(),
        salt: this.productionSalt,
        hash: this.productionPasswordHash,
        lastUpdated: this.lastUpdated,
      };
      fs.writeFileSync(SECURITY_STORAGE_PATH, JSON.stringify(data, null, 2), {
        encoding: "utf-8",
        mode: 0o600, // Read/write only by owner
      });
    } catch (_err) {
      // In-memory fallback if disk is read-only
    }
  }

  private loadPersistedProductionCredentials(): void {
    try {
      if (fs.existsSync(SECURITY_STORAGE_PATH)) {
        const raw = fs.readFileSync(SECURITY_STORAGE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.salt && parsed.hash) {
          this.productionSalt = parsed.salt;
          this.productionPasswordHash = parsed.hash;
          this.lastUpdated = parsed.lastUpdated || null;
        }
      }
    } catch (_err) {
      // Fallback
    }
  }
}
