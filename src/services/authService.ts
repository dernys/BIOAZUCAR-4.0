import { UserAccount, UserRole, SystemParameterConfig } from "../types";

export const PREDEFINED_USERS: (UserAccount & { passwordHash: string })[] = [
  {
    id: "usr-superadmin",
    email: "ing.dernys@gmail.com",
    passwordHash: "D3rnys2026*",
    name: "Ing. Dernys (Super Administrador)",
    role: "superadmin",
    tenantId: "GLOBAL",
    department: "Dirección de Automatización & Operaciones Globales",
    badgeCode: "SA-0001",
    isSuperAdmin: true,
    securityLevel: 5,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    phone: "+58 412 000-0000",
    lastLogin: "2026-08-28 17:50:12",
  },
  {
    id: "usr-admin-01",
    email: "admin@bioazucar.com",
    passwordHash: "Admin2026*",
    name: "Ing. Laura Silva (Gerente de Planta)",
    role: "administrador",
    tenantId: "tenant-bioazucar-01",
    department: "Gerencia General de Planta & Cogeneración",
    badgeCode: "ADM-102",
    isSuperAdmin: false,
    securityLevel: 4,
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    phone: "+58 414 111-2233",
    lastLogin: "2026-08-28 16:10:45",
  },
  {
    id: "usr-sup-01",
    email: "supervisor@bioazucar.com",
    passwordHash: "Supervisor2026*",
    name: "Ing. Carlos Mendoza (Jefe de Turno A)",
    role: "supervisor",
    tenantId: "tenant-bioazucar-01",
    department: "Supervisión de Molienda & Fabril",
    badgeCode: "SUP-304",
    isSuperAdmin: false,
    securityLevel: 3,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    phone: "+58 424 555-8899",
    lastLogin: "2026-08-28 15:30:20",
  },
  {
    id: "usr-op-01",
    email: "operador@bioazucar.com",
    passwordHash: "Operador2026*",
    name: "Roberto Gómez (Operador Sala DCS)",
    role: "operador",
    tenantId: "tenant-bioazucar-01",
    department: "Operaciones DCS & Recepción de Caña",
    badgeCode: "OP-508",
    isSuperAdmin: false,
    securityLevel: 2,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    phone: "+58 416 777-4422",
    lastLogin: "2026-08-28 14:15:00",
  },
  {
    id: "usr-maint-01",
    email: "mantenimiento@bioazucar.com",
    passwordHash: "Mantenimiento2026*",
    name: "Ing. Elena Suárez (Confiabilidad & CBM)",
    role: "mantenimiento",
    tenantId: "tenant-bioazucar-01",
    department: "Mantenimiento Predictivo & Vibraciones ISO 10816",
    badgeCode: "MNT-712",
    isSuperAdmin: false,
    securityLevel: 2,
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    phone: "+58 412 888-9900",
    lastLogin: "2026-08-28 13:40:10",
  },
];

const AUTH_STORAGE_KEY = "bioazucar_active_user_session";

export function getStoredUser(): UserAccount {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error reading stored user:", e);
  }
  // Default to Superadmin user for convenience
  const defaultUser = { ...PREDEFINED_USERS[0] };
  delete (defaultUser as any).passwordHash;
  return defaultUser;
}

export function saveStoredUser(user: UserAccount): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.error("Error saving stored user:", e);
  }
}

export const setStoredUser = saveStoredUser;

export function authenticateUser(email: string, password: string): {
  success: boolean;
  user?: UserAccount;
  error?: string;
} {
  const cleanEmail = (email || "").trim().toLowerCase();
  const found = PREDEFINED_USERS.find(
    (u) => u.email.toLowerCase() === cleanEmail
  );

  if (!found) {
    return {
      success: false,
      error: `No existe ningún usuario registrado con el correo "${email}".`,
    };
  }

  if (found.passwordHash !== password) {
    return {
      success: false,
      error: "Contraseña incorrecta. Verifique mayúsculas y caracteres especiales.",
    };
  }

  const { passwordHash, ...userClean } = found;
  const userWithTimestamp: UserAccount = {
    ...userClean,
    lastLogin: new Date().toISOString().slice(0, 19).replace("T", " "),
  };

  saveStoredUser(userWithTimestamp);
  return {
    success: true,
    user: userWithTimestamp,
  };
}

export function switchUserByRole(role: UserRole): UserAccount {
  const found = PREDEFINED_USERS.find((u) => u.role === role) || PREDEFINED_USERS[0];
  const { passwordHash, ...userClean } = found;
  const userWithTimestamp: UserAccount = {
    ...userClean,
    lastLogin: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
  saveStoredUser(userWithTimestamp);
  return userWithTimestamp;
}

export const INITIAL_SYSTEM_CONFIGS: SystemParameterConfig[] = [
  // 1. PLC & SCADA Process Limits
  {
    id: "cfg-01",
    category: "PLC_SCADA",
    name: "Capacidad Nominal de Molienda (TCH)",
    key: "MILLING_NOMINAL_TCH",
    currentValue: 450.0,
    defaultValue: 450.0,
    unit: "TCH",
    description: "Flujo objetivo de caña por hora alimentada al tren de molienda tándem.",
    minLimit: 200.0,
    maxLimit: 550.0,
    status: "VERIFIED",
    lastVerified: "2026-08-28 17:40:00",
    verifiedBy: "Ing. Dernys (Superadmin)",
  },
  {
    id: "cfg-02",
    category: "PLC_SCADA",
    name: "Consigna Presión Vapor Alta Presión (HP)",
    key: "BOILER_HP_PRESSURE_SETPOINT",
    currentValue: 64.5,
    defaultValue: 65.0,
    unit: "Bar",
    description: "Presión en colector de sobrecalentador de calderas acuotubulares de bagazo.",
    minLimit: 50.0,
    maxLimit: 68.0,
    status: "VERIFIED",
    lastVerified: "2026-08-28 17:35:10",
    verifiedBy: "Ing. Carlos Mendoza (Supervisor)",
  },
  {
    id: "cfg-03",
    category: "STEAM_ENERGY",
    name: "Temperatura de Vapor Sobrecalentado HP",
    key: "BOILER_HP_TEMP_SETPOINT",
    currentValue: 485.0,
    defaultValue: 480.0,
    unit: "°C",
    description: "Temperatura del vapor vivo hacia turbogeneradores de extracción/condensación.",
    minLimit: 420.0,
    maxLimit: 510.0,
    status: "VERIFIED",
    lastVerified: "2026-08-28 17:35:10",
    verifiedBy: "Ing. Laura Silva (Admin)",
  },
  {
    id: "cfg-04",
    category: "STEAM_ENERGY",
    name: "Precio Contrato PPA Exportación SEN",
    key: "PPA_CONTRACT_USD_MWH",
    currentValue: 76.0,
    defaultValue: 76.0,
    unit: "USD/MWh",
    description: "Tarifa base acordada para suministro de energía limpia renovable a la red nacional.",
    minLimit: 40.0,
    maxLimit: 120.0,
    status: "VERIFIED",
    lastVerified: "2026-08-28 16:00:00",
    verifiedBy: "Ing. Dernys (Superadmin)",
  },
  {
    id: "cfg-05",
    category: "IIOT_GATEWAYS",
    name: "OPC UA Industrial Security Mode",
    key: "OPCUA_SECURITY_MODE",
    currentValue: "SignAndEncrypt (Basic256Sha256)",
    defaultValue: "SignAndEncrypt (Basic256Sha256)",
    description: "Cifrado y firma criptográfica de certificados X.509 en nodos Siemens S7-1500.",
    status: "VERIFIED",
    lastVerified: "2026-08-28 17:00:00",
    verifiedBy: "Ing. Dernys (Superadmin)",
  },
  {
    id: "cfg-06",
    category: "IIOT_GATEWAYS",
    name: "MQTT Sparkplug B Edge Topic Namespace",
    key: "MQTT_SPARKPLUG_TOPIC_ROOT",
    currentValue: "spBv1.0/BIOAZUCAR_SITE01",
    defaultValue: "spBv1.0/BIOAZUCAR_SITE01",
    description: "Estructura jerárquica unificada de tópicos UNS según norma ISA-95.",
    status: "VERIFIED",
    lastVerified: "2026-08-28 17:00:00",
    verifiedBy: "Ing. Dernys (Superadmin)",
  },
  {
    id: "cfg-07",
    category: "FIRESTORE_DB",
    name: "Base de Datos Firestore Database ID",
    key: "FIRESTORE_DATABASE_ID",
    currentValue: "ai-studio-bioazcar40smartm-7390a107",
    defaultValue: "ai-studio-bioazcar40smartm-7390a107",
    description: "Instancia persistente en la nube para almacenamiento de telemetría y registros MES.",
    status: "VERIFIED",
    lastVerified: "2026-08-28 17:50:00",
    verifiedBy: "Ing. Dernys (Superadmin)",
  },
  {
    id: "cfg-08",
    category: "SECURITY_RBAC",
    name: "Nivel de Ciberseguridad Industrial",
    key: "IEC_62443_TARGET_SL",
    currentValue: "SL-3 (Resistente a intrusiones sofisticadas)",
    defaultValue: "SL-3 (Resistente a intrusiones sofisticadas)",
    description: "Cumplimiento normativo IEC 62443-3-3 con autenticación mTLS y RBAC estricto.",
    status: "VERIFIED",
    lastVerified: "2026-08-28 17:50:00",
    verifiedBy: "Ing. Dernys (Superadmin)",
  },
  {
    id: "cfg-09",
    category: "QUALITY_LIMS",
    name: "Algoritmo de Cálculo ARE (Azúcar Recuperable)",
    key: "ARE_FORMULA_COEFFICIENT",
    currentValue: "ARE = 10.2 * Pol - 20.5 (kg/t)",
    defaultValue: "ARE = 10.2 * Pol - 20.5 (kg/t)",
    description: "Fórmula de liquidación a cañicultores según calidad de jugo en báscula.",
    status: "VERIFIED",
    lastVerified: "2026-08-28 16:30:00",
    verifiedBy: "Ing. Laura Silva (Admin)",
  },
];
