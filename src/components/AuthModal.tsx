import React, { useState } from "react";
import {
  Shield,
  ShieldCheck,
  Lock,
  Mail,
  Key,
  User,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Fingerprint,
  UserCheck,
  Building,
  Phone,
  Clock,
  Zap,
  ExternalLink
} from "lucide-react";
import { UserAccount, UserRole } from "../types";
import { PREDEFINED_USERS, authenticateUser, saveStoredUser } from "../services/authService";
import { getRoleBadgeInfo } from "../services/rbacService";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onLoginSuccess: (user: UserAccount) => void;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<"LOGIN" | "CURRENT_SESSION" | "USERS_DIRECTORY">("LOGIN");
  const [emailInput, setEmailInput] = useState<string>("ing.dernys@gmail.com");
  const [passwordInput, setPasswordInput] = useState<string>("D3rnys2026*");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    setTimeout(() => {
      const result = authenticateUser(emailInput, passwordInput);
      setIsSubmitting(false);

      if (result.success && result.user) {
        setSuccessMessage(`¡Autenticación exitosa! Bienvenido ${result.user.name}.`);
        onLoginSuccess(result.user);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage(result.error || "Credenciales inválidas.");
      }
    }, 400);
  };

  const handleQuickLogin = (userWithPass: typeof PREDEFINED_USERS[0]) => {
    setEmailInput(userWithPass.email);
    setPasswordInput(userWithPass.passwordHash);
    const result = authenticateUser(userWithPass.email, userWithPass.passwordHash);
    if (result.success && result.user) {
      setSuccessMessage(`Sesión iniciada como ${result.user.name}.`);
      onLoginSuccess(result.user);
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const roleInfo = getRoleBadgeInfo(currentUser.role);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-tech uppercase tracking-wide">
                  Autenticación & Control de Acceso
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  IEC 62443 SL-3
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Acceso corporativo unificado por roles, permisos y credenciales industriales
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs transition"
          >
            ✕
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 bg-slate-900 text-xs">
          <button
            onClick={() => setActiveTab("LOGIN")}
            className={`pb-2.5 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "LOGIN"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Iniciar Sesión
          </button>
          <button
            onClick={() => setActiveTab("CURRENT_SESSION")}
            className={`pb-2.5 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "CURRENT_SESSION"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Sesión Activa
          </button>
          <button
            onClick={() => setActiveTab("USERS_DIRECTORY")}
            className={`pb-2.5 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "USERS_DIRECTORY"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Cuentas & Roles
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 scrollbar-thin">
          {/* Messages */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {activeTab === "LOGIN" && (
            <div className="space-y-5">
              {/* Form */}
              <form onSubmit={handleManualLogin} className="space-y-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="text-xs text-slate-300 flex items-center gap-1.5 mb-1.5 font-bold">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                    Correo Electrónico Corporativo:
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="usuario@bioazucar.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 flex items-center gap-1.5 mb-1.5 font-bold">
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                    Contraseña / Token de Seguridad:
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500">
                    Cifrado AES-256 GCM • Validación mTLS
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition disabled:opacity-50"
                  >
                    <span>{isSubmitting ? "Autenticando..." : "Ingresar al Sistema"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>

              {/* Quick Persona Logins */}
              <div>
                <span className="text-xs text-slate-400 block mb-2.5 font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Acceso Rápido por Perfil (1-Click Switch):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PREDEFINED_USERS.map((usr) => {
                    const isCurrent = currentUser.email === usr.email;
                    const isSuper = usr.role === "superadmin";
                    return (
                      <button
                        key={usr.id}
                        type="button"
                        onClick={() => handleQuickLogin(usr)}
                        className={`p-2.5 rounded-xl text-left border transition flex items-center justify-between gap-2.5 ${
                          isCurrent
                            ? "bg-emerald-500/15 border-emerald-500/50 ring-1 ring-emerald-500/30"
                            : isSuper
                            ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20"
                            : "bg-slate-950/60 border-slate-800 hover:bg-slate-800/80"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={usr.avatar}
                            alt={usr.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1">
                              <span>{usr.name}</span>
                              {isSuper && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-extrabold">
                                  ROOT
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{usr.email}</div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              usr.role === "superadmin"
                                ? "bg-amber-500/20 text-amber-300"
                                : usr.role === "administrador"
                                ? "bg-purple-500/20 text-purple-300"
                                : usr.role === "supervisor"
                                ? "bg-amber-500/20 text-amber-300"
                                : usr.role === "operador"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-cyan-500/20 text-cyan-300"
                            }`}
                          >
                            {usr.role}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "CURRENT_SESSION" && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex items-start gap-4">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-lg"
                />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{currentUser.name}</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleInfo.color}`}
                    >
                      {roleInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{currentUser.email}</p>
                  <div className="text-[11px] text-slate-500 flex items-center gap-3 pt-1">
                    <span>Placa: <strong className="text-slate-300">{currentUser.badgeCode}</strong></span>
                    <span>Depto: <strong className="text-slate-300">{currentUser.department}</strong></span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Nivel de Seguridad</span>
                  <span className="text-emerald-400 font-bold mt-0.5 block">{roleInfo.clearance}</span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Último Inicio de Sesión</span>
                  <span className="text-slate-200 font-bold mt-0.5 block">{currentUser.lastLogin || "En línea"}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={onLogout}
                  className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-2 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión Activa</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "USERS_DIRECTORY" && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 pb-1">
                Directorio de Usuarios Corporativos y Matriz de Roles (Zafra 2026):
              </div>
              <div className="space-y-2">
                {PREDEFINED_USERS.map((u) => (
                  <div
                    key={u.id}
                    className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={u.avatar}
                        alt={u.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <div className="font-bold text-slate-200">{u.name}</div>
                        <div className="text-[10px] text-slate-400">{u.email} • {u.department}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        Nivel {u.securityLevel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
