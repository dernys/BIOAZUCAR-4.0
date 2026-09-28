/**
 * BIOAZÚCAR 4.0 — WEBAUTHN / FIDO2 CONTROL ROOM OPERATOR CONSOLE MODAL
 * ==============================================================================
 * Conforms to IEC 62443-4-2 FR1 (Human User Identification & Authentication SL3),
 * IEC 62443-4-2 FR2 (Use Control & Hardware Factor Enforcement).
 * 
 * Provides:
 * 1. Physical YubiKey Touch & Assertion flow with visual presence guidance.
 * 2. Hardware Token Registration ceremony.
 * 3. Enrolled Hardware Keys Management & Anti-Cloning Audit.
 * 4. Dual-Supervisor Emergency Break-Glass Override with SHA-256 tamper seal.
 */

import React, { useState, useEffect } from "react";
import {
  Key,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Fingerprint,
  Usb,
  Radio,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lock,
  Unlock,
  Trash2,
  Clock,
  Zap,
} from "lucide-react";
import { webAuthnClientService } from "../../services/security/webauthn/WebAuthnClientService";
import {
  WebAuthnCredentialRecord,
  PhysicalOperatorSession,
  EmergencyBreakGlassAudit,
} from "../../types/webauthn";
import { UserRole } from "../../types";

interface WebAuthnControlRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
  currentUserUid?: string;
  currentRole?: UserRole;
  onSessionChanged?: (session: PhysicalOperatorSession | null) => void;
}

type TabType = "AUTHENTICATE" | "REGISTER" | "INVENTORY" | "BREAK_GLASS";

export const WebAuthnControlRoomModal: React.FC<WebAuthnControlRoomModalProps> = ({
  isOpen,
  onClose,
  currentUserEmail = "operador@bioazucar.com",
  currentUserUid = "usr-op-01",
  currentRole = "operador",
  onSessionChanged,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("AUTHENTICATE");
  const [session, setSession] = useState<PhysicalOperatorSession | null>(null);
  const [credentials, setCredentials] = useState<WebAuthnCredentialRecord[]>([]);
  const [audits, setAudits] = useState<EmergencyBreakGlassAudit[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Registration Form State
  const [regDeviceName, setRegDeviceName] = useState("YubiKey 5 NFC — Puesto DCS Molino 1");
  const [regStatusStep, setRegStatusStep] = useState<string | null>(null);

  // Authentication State
  const [isPromptingTouch, setIsPromptingTouch] = useState(false);

  // Break-Glass Form State
  const [bgSupervisorA, setBgSupervisorA] = useState("supervisor@bioazucar.com");
  const [bgPinA, setBgPinA] = useState("");
  const [bgSupervisorB, setBgSupervisorB] = useState("admin@bioazucar.com");
  const [bgPinB, setBgPinB] = useState("");
  const [bgZone, setBgZone] = useState("MOLIENDA_TANDEM1");
  const [bgReason, setBgReason] = useState("");
  const [bgDuration, setBgDuration] = useState(60);

  useEffect(() => {
    if (!isOpen) return;
    refreshState();
  }, [isOpen]);

  const refreshState = async () => {
    const curSession = webAuthnClientService.getSession();
    setSession(curSession);
    try {
      const creds = await webAuthnClientService.fetchEnrolledCredentials();
      setCredentials(creds);

      const auditRes = await fetch("/api/auth/webauthn/audits").catch(() => null);
      if (auditRes && auditRes.ok) {
        const auditData = await auditRes.json();
        setAudits(auditData.audits || []);
      }
    } catch (err) {
      console.warn("[WebAuthnModal] State refresh error:", err);
    }
  };

  if (!isOpen) return null;

  // Handle Physical Touch Authentication
  const handleAuthenticate = async () => {
    setLoading(true);
    setIsPromptingTouch(true);
    setFeedback({
      type: "info",
      message: "Por favor inserte su YubiKey y toque el sensor dorado de contacto físico...",
    });

    try {
      const res = await webAuthnClientService.authenticateWithHardwareKey({
        userEmail: currentUserEmail,
      });
      setSession(res.session);
      onSessionChanged?.(res.session);
      setFeedback({
        type: "success",
        message: `Autenticación FIDO2 exitosa con '${res.session.deviceName}'. Certificación IEC 62443 SL3 activada.`,
      });
      refreshState();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Fallo en la verificación de la llave física.",
      });
    } finally {
      setLoading(false);
      setIsPromptingTouch(false);
    }
  };

  // Handle Hardware Key Registration
  const handleRegister = async () => {
    if (!regDeviceName.trim()) {
      setFeedback({ type: "error", message: "Ingrese un nombre descriptivo para la llave física." });
      return;
    }

    setLoading(true);
    setRegStatusStep("Iniciando ceremonia FIDO2... Toque el sensor de su YubiKey cuando parpadee.");
    try {
      const res = await webAuthnClientService.registerHardwareKey({
        userUid: currentUserUid,
        userEmail: currentUserEmail,
        deviceName: regDeviceName,
      });

      setFeedback({
        type: "success",
        message: `Llave física '${res.credential.deviceName}' enrolada exitosamente en el registro industrial.`,
      });
      setRegStatusStep(null);
      refreshState();
      setActiveTab("INVENTORY");
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Error al registrar la llave física.",
      });
      setRegStatusStep(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle Key Revocation
  const handleRevoke = async (id: string) => {
    if (!confirm(`¿Está seguro de revocar la llave física '${id}'? Esta acción invalidará su acceso SL3.`)) {
      return;
    }
    setLoading(true);
    try {
      await webAuthnClientService.revokeCredential(id);
      setFeedback({ type: "success", message: `Llave '${id}' revocada correctamente.` });
      refreshState();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Error al revocar la llave." });
    } finally {
      setLoading(false);
    }
  };

  // Handle Emergency Break-Glass Override
  const handleBreakGlass = async () => {
    if (!bgPinA || !bgPinB || !bgReason.trim() || bgReason.length < 10) {
      setFeedback({
        type: "error",
        message: "Se requieren los PINs de ambos supervisores y una justificación técnica detallada (>=10 caracteres).",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await webAuthnClientService.executeEmergencyBreakGlass({
        targetUserUid: currentUserUid,
        supervisorAEmail: bgSupervisorA,
        supervisorAPin: bgPinA,
        supervisorBEmail: bgSupervisorB,
        supervisorBPin: bgPinB,
        plantZone: bgZone,
        reason: bgReason,
        durationMinutes: bgDuration,
      });

      setSession(res.session);
      onSessionChanged?.(res.session);
      setFeedback({
        type: "success",
        message: `Sobremarcha de Emergencia activada con éxito [${res.audit.overrideId}]. Sello SHA-256 generado.`,
      });
      refreshState();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Error al procesar la sobremarcha de emergencia.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearSession = () => {
    webAuthnClientService.clearSession();
    setSession(null);
    onSessionChanged?.(null);
    setFeedback({ type: "info", message: "Sesión física cerrada. Certificación SL3 desactivada." });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-cyan-500/40 shadow-2xl rounded-none flex flex-col max-h-[92vh] overflow-hidden text-slate-100 font-mono">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/30 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-950/80 border border-cyan-500/60 text-cyan-400">
              <Key className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs tracking-widest text-cyan-400 font-bold uppercase">
                  SEGURIDAD INDUSTRIAL IEC 62443-4-2 SL3
                </span>
                <span className="px-1.5 py-0.5 text-[10px] bg-emerald-950 border border-emerald-500 text-emerald-400 font-semibold">
                  FR1 / FR2 CONFORME
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                Autenticación Física WebAuthn / FIDO2 — Sala de Control
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 bg-slate-800 hover:bg-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Global Security Status Banner */}
        <div className="bg-slate-950 border-b border-slate-800 px-6 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-400">Operador:</span>
            <span className="font-semibold text-white">{currentUserEmail}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Rol:</span>
            <span className="uppercase text-cyan-400 font-semibold">{currentRole}</span>
          </div>
          <div className="flex items-center gap-2">
            {session && session.sl3Certified ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                SL3 VALIDADO: {session.deviceName}
              </span>
            ) : session && session.authMethod === "EMERGENCY_BREAK_GLASS_DUAL_SUPERVISOR" ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-950/80 border border-amber-500/80 text-amber-300 font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                SOBREMARCHA DE EMERGENCIA ACTIVA
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-950/80 border border-rose-500/80 text-rose-300">
                <ShieldAlert className="w-3.5 h-3.5" />
                SIN AUTENTICACIÓN FÍSICA FIDO2
              </span>
            )}
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab("AUTHENTICATE")}
            className={`px-4 py-2 border-t-2 font-semibold transition flex items-center gap-2 ${
              activeTab === "AUTHENTICATE"
                ? "border-cyan-400 bg-slate-900 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Fingerprint className="w-4 h-4" />
            1. Verificación YubiKey
          </button>
          <button
            onClick={() => setActiveTab("REGISTER")}
            className={`px-4 py-2 border-t-2 font-semibold transition flex items-center gap-2 ${
              activeTab === "REGISTER"
                ? "border-cyan-400 bg-slate-900 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Usb className="w-4 h-4" />
            2. Enrolar Nueva Llave
          </button>
          <button
            onClick={() => setActiveTab("INVENTORY")}
            className={`px-4 py-2 border-t-2 font-semibold transition flex items-center gap-2 ${
              activeTab === "INVENTORY"
                ? "border-cyan-400 bg-slate-900 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-4 h-4" />
            3. Registro de Llaves ({credentials.length})
          </button>
          <button
            onClick={() => setActiveTab("BREAK_GLASS")}
            className={`px-4 py-2 border-t-2 font-semibold transition flex items-center gap-2 ${
              activeTab === "BREAK_GLASS"
                ? "border-amber-400 bg-slate-900 text-amber-300"
                : "border-transparent text-amber-500/70 hover:text-amber-300"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            4. Sobremarcha de Emergencia
          </button>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              feedback.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                : feedback.type === "error"
                ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                : "bg-cyan-950/60 border-cyan-500/40 text-cyan-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {feedback.type === "error" && <XCircle className="w-4 h-4 shrink-0" />}
              {feedback.type === "info" && <RefreshCw className="w-4 h-4 animate-spin shrink-0" />}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: AUTHENTICATE */}
          {activeTab === "AUTHENTICATE" && (
            <div className="space-y-6">
              <div className="bg-slate-950 border border-slate-800 p-5">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-slate-900 border border-cyan-500/40 text-cyan-400 shrink-0">
                    <Fingerprint className={`w-8 h-8 ${isPromptingTouch ? "animate-pulse text-amber-400" : ""}`} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Prueba de Presencia Humana & Validación FIDO2 (User Present - UP)
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Conforme al estándar IEC 62443 SL3, la sala de control requiere la comprobación de contacto físico
                      en la llave de hardware YubiKey antes de permitir consignas críticas sobre molinos, calderas y
                      generación.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
                      <div className="bg-slate-900 p-2 border border-slate-800">
                        <span className="text-slate-500 block">Algoritmo:</span>
                        <span className="font-semibold text-cyan-300">ES256 (NIST P-256)</span>
                      </div>
                      <div className="bg-slate-900 p-2 border border-slate-800">
                        <span className="text-slate-500 block">Anti-Clonación:</span>
                        <span className="font-semibold text-emerald-400">Contador Monotónico</span>
                      </div>
                      <div className="bg-slate-900 p-2 border border-slate-800">
                        <span className="text-slate-500 block">Transportes:</span>
                        <span className="font-semibold text-slate-300">USB-A / USB-C / NFC</span>
                      </div>
                      <div className="bg-slate-900 p-2 border border-slate-800">
                        <span className="text-slate-500 block">Expiración Sesión:</span>
                        <span className="font-semibold text-slate-300">8 Horas (Turno)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                  {session ? (
                    <div className="flex items-center gap-3">
                      <div className="text-xs">
                        <span className="text-slate-400">Sesión Activa: </span>
                        <span className="text-emerald-400 font-bold">{session.sessionId}</span>
                        <span className="text-slate-500 ml-2">({session.deviceName})</span>
                      </div>
                      <button
                        onClick={handleClearSession}
                        className="px-3 py-1 bg-rose-950 border border-rose-500 text-rose-300 text-xs hover:bg-rose-900 transition flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Cerrar Sesión Física
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Requiere toque de contacto en YubiKey para habilitar consignas SL3
                    </span>
                  )}

                  <button
                    onClick={handleAuthenticate}
                    disabled={loading}
                    className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    {loading ? "Esperando Contacto..." : "Verificar Presencia YubiKey"}
                  </button>
                </div>
              </div>

              {/* Instructions Guide */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-950 border border-slate-800 p-3">
                  <div className="text-cyan-400 font-bold mb-1 flex items-center gap-1.5">
                    <Usb className="w-3.5 h-3.5" /> 1. Conectar YubiKey
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Inserte su llave física en el puerto USB de la estación o acerque su tarjeta NFC al lector industrial.
                  </p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3">
                  <div className="text-amber-400 font-bold mb-1 flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5" /> 2. Tocar Sensor Dorado
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Cuando el LED parpadee, toque el electrodo dorado para generar la firma criptográfica asimétrica.
                  </p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3">
                  <div className="text-emerald-400 font-bold mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> 3. Consignas SL3 Habilitadas
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    El sistema certifica la sesión como hardware-verified y habilita cambios en enclavamientos de planta.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTER */}
          {activeTab === "REGISTER" && (
            <div className="space-y-6">
              <div className="bg-slate-950 border border-slate-800 p-5 space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Usb className="w-4 h-4 text-cyan-400" />
                    Enrolamiento de Nueva Llave de Hardware FIDO2
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Registra una llave física asociada a su identidad técnica en la Bóveda Industrial de BioAzúcar.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Nombre Descriptivo del Dispositivo:</label>
                    <input
                      type="text"
                      value={regDeviceName}
                      onChange={(e) => setRegDeviceName(e.target.value)}
                      placeholder="e.g. YubiKey 5 NFC — Consola Sala Molinos"
                      className="w-full bg-slate-900 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:border-cyan-400 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Operador / Cuenta Destino:</label>
                    <input
                      type="text"
                      disabled
                      value={`${currentUserEmail} (${currentUserUid})`}
                      className="w-full bg-slate-900/50 border border-slate-800 px-3 py-2 text-slate-400 text-xs cursor-not-allowed"
                    />
                  </div>
                </div>

                {regStatusStep && (
                  <div className="p-3 bg-cyan-950/50 border border-cyan-500/40 text-cyan-300 text-xs flex items-center gap-2 animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                    <span>{regStatusStep}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleRegister}
                    disabled={loading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {loading ? "Procesando Ceremonia..." : "Iniciar Ceremonia de Enrolamiento"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY */}
          {activeTab === "INVENTORY" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Total de llaves registradas en la planta: <strong className="text-white">{credentials.length}</strong>
                </span>
                <button
                  onClick={refreshState}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar Lista
                </button>
              </div>

              <div className="border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Dispositivo</th>
                      <th className="p-3">Operador</th>
                      <th className="p-3">Transportes</th>
                      <th className="p-3">Contador (SignCount)</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Último Uso</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                    {credentials.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-500">
                          No hay llaves físicas enroladas.
                        </td>
                      </tr>
                    ) : (
                      credentials.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-850/50 transition">
                          <td className="p-3 font-semibold text-white">
                            <div className="flex items-center gap-1.5">
                              <Key className="w-3.5 h-3.5 text-cyan-400" />
                              {c.deviceName}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-xs">{c.id}</div>
                          </td>
                          <td className="p-3 text-slate-300">{c.userEmail}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {c.transports.map((t) => (
                                <span
                                  key={t}
                                  className="px-1.5 py-0.5 text-[9px] bg-slate-800 border border-slate-700 uppercase"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-emerald-400 font-bold">{c.signCount}</td>
                          <td className="p-3">
                            {c.status === "ACTIVE" ? (
                              <span className="px-2 py-0.5 text-[10px] bg-emerald-950 border border-emerald-500 text-emerald-300">
                                ACTIVA
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] bg-rose-950 border border-rose-500 text-rose-300">
                                {c.status}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {new Date(c.lastUsedAt).toLocaleString()}
                          </td>
                          <td className="p-3 text-right">
                            {c.status === "ACTIVE" && (
                              <button
                                onClick={() => handleRevoke(c.id)}
                                className="px-2 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 text-[10px] transition flex items-center gap-1 ml-auto"
                              >
                                <Trash2 className="w-3 h-3" /> Revocar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: BREAK GLASS */}
          {activeTab === "BREAK_GLASS" && (
            <div className="space-y-6">
              <div className="bg-amber-950/20 border border-amber-500/40 p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  Protocolo de Sobremarcha de Emergencia (IEC 62443-2-1 Break-Glass)
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Permite habilitar la consola de control ante pérdida, avería física de YubiKeys o desconexión
                  catastrófica. <strong>Requiere la autorización dual simultánea de 2 supervisores distintos</strong> y
                  genera un acta inmutable con sello criptográfico SHA-256.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Supervisor A */}
                  <div className="p-3 bg-slate-900 border border-slate-800 space-y-2">
                    <span className="text-cyan-400 font-bold uppercase text-[10px]">Supervisor Autorizante 1:</span>
                    <input
                      type="email"
                      value={bgSupervisorA}
                      onChange={(e) => setBgSupervisorA(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 text-white text-xs"
                      placeholder="supervisor1@bioazucar.com"
                    />
                    <input
                      type="password"
                      value={bgPinA}
                      onChange={(e) => setBgPinA(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 text-white text-xs"
                      placeholder="PIN de Seguridad (4+ dígitos)"
                    />
                  </div>

                  {/* Supervisor B */}
                  <div className="p-3 bg-slate-900 border border-slate-800 space-y-2">
                    <span className="text-cyan-400 font-bold uppercase text-[10px]">Supervisor Autorizante 2:</span>
                    <input
                      type="email"
                      value={bgSupervisorB}
                      onChange={(e) => setBgSupervisorB(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 text-white text-xs"
                      placeholder="supervisor2@bioazucar.com"
                    />
                    <input
                      type="password"
                      value={bgPinB}
                      onChange={(e) => setBgPinB(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 text-white text-xs"
                      placeholder="PIN de Seguridad (4+ dígitos)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1">Zona Industrial de la Planta:</label>
                    <select
                      value={bgZone}
                      onChange={(e) => setBgZone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 px-3 py-1.5 text-white text-xs"
                    >
                      <option value="MOLIENDA_TANDEM1">Molienda — Tándem 1</option>
                      <option value="CALDERAS_BAGAZO">Generación de Vapor — Calderas</option>
                      <option value="DCS_CENTRAL">Sala DCS Central de Planta</option>
                      <option value="PATIO_CANAS">Patio & Recepción de Caña</option>
                      <option value="TURBOGENERADORES">Subestación & Turbogeneración</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Duración Máxima (Minutos):</label>
                    <select
                      value={bgDuration}
                      onChange={(e) => setBgDuration(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 px-3 py-1.5 text-white text-xs"
                    >
                      <option value={30}>30 minutos</option>
                      <option value={60}>60 minutos (1 hora)</option>
                      <option value={120}>120 minutos (2 horas)</option>
                      <option value={240}>240 minutos (4 horas)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Operador Beneficiario:</label>
                    <input
                      type="text"
                      disabled
                      value={currentUserEmail}
                      className="w-full bg-slate-900/50 border border-slate-800 px-3 py-1.5 text-slate-400 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Justificación Técnica Obligatoria:</label>
                  <textarea
                    rows={2}
                    value={bgReason}
                    onChange={(e) => setBgReason(e.target.value)}
                    placeholder="Detalle el motivo operacional (e.g. Llave física dañada en parada no programada de molino #2)..."
                    className="w-full bg-slate-900 border border-slate-700 p-2 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleBreakGlass}
                    disabled={loading}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    <Unlock className="w-4 h-4" />
                    {loading ? "Validando Supervisores..." : "Ejecutar Sobremarcha Break-Glass"}
                  </button>
                </div>
              </div>

              {/* Past Audits List */}
              {audits.length > 0 && (
                <div className="border border-slate-800 p-4 bg-slate-950 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Historial de Sobremarchas de Emergencia Auditadas
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {audits.map((a) => (
                      <div
                        key={a.overrideId}
                        className="p-2.5 bg-slate-900 border border-slate-800 text-[11px] flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-400">{a.overrideId}</span>
                            <span className="text-slate-400">({a.plantZone})</span>
                            <span className="text-slate-500">• {new Date(a.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="text-slate-400 text-[10px] mt-0.5">
                            Supervisores: {a.supervisorAEmail} & {a.supervisorBEmail} | {a.reason}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] text-slate-500 font-mono">
                            SHA-256: {a.tamperSealSha256.substring(0, 16)}...
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950 px-6 py-3 flex items-center justify-between text-xs">
          <div className="text-slate-500 text-[11px] flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            BioAzúcar 4.0 — Módulo Criptográfico FIDO2 / W3C WebAuthn Level 3
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs font-semibold"
          >
            Cerrar Consola
          </button>
        </div>
      </div>
    </div>
  );
};
