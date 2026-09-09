import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Building2,
  Bot,
  RotateCcw,
  Zap,
  Layers,
  HelpCircle,
  Activity,
  MessageSquare,
} from "lucide-react";
import {
  TelemetryData,
  AlarmEvent,
  EquipmentItem,
  TenantEnterprise,
  UserAccount,
  UserRole,
  NavigationTab,
  DataLineageInfo,
} from "../../types";
import {
  CopilotChatMessage,
  CopilotAction,
  CopilotUserContext,
} from "../domain/CopilotTypes";
import { copilotContextService } from "../services/copilotContextService";
import { copilotService } from "../services/copilotService";
import { CopilotMessage } from "./CopilotMessage";
import { CopilotQuickActions } from "./CopilotQuickActions";
import { CopilotAuditModal } from "./CopilotAuditModal";

interface BioAzucarCopilotProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  currentUser: UserAccount;
  currentRole: UserRole;
  activeTenant: TenantEnterprise;
  activeTab: NavigationTab;
  telemetry: TelemetryData;
  alarms: AlarmEvent[];
  equipmentList: EquipmentItem[];
  onNavigate: (tab: NavigationTab) => void;
  onOpenLineageModal?: (lineage: DataLineageInfo) => void;
  onAcknowledgeAlarm?: (alarmId: string) => void;
  onUpdateSetpoint?: (tag: string, value: number) => void;
  onDispatchUpdate?: (exportMW: number) => void;
  isFooterPinned?: boolean;
}

export const BioAzucarCopilot: React.FC<BioAzucarCopilotProps> = ({
  isOpen,
  onToggleOpen,
  currentUser,
  currentRole,
  activeTenant,
  activeTab,
  telemetry,
  alarms,
  equipmentList,
  onNavigate,
  onOpenLineageModal,
  onAcknowledgeAlarm,
  onUpdateSetpoint,
  onDispatchUpdate,
  isFooterPinned = true,
}) => {
  const [messages, setMessages] = useState<CopilotChatMessage[]>(() => [
    {
      id: "msg-welcome",
      sender: "copilot",
      text: `Hola **${currentUser.name || "Operador"}**. Soy **BioAzúcar Copilot**, el asistente inteligente de **BioAzúcar 4.0** en **${activeTenant.name}**.\n\nPuedo ayudarte a consultar y analizar el estado de planta en tiempo real, KPIs, producción, cogeneración, alarmas, equipos, linaje de datos, navegación autorizada y ejecución de acciones seguras.\n\nPuedes preguntarme **“¿Qué puedes hacer?”** o seleccionar una de las acciones rápidas contextuales a continuación.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      intent: "CAPABILITIES",
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Handle Send message
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || isProcessing) return;

    const userMessage: CopilotChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputPrompt("");
    setIsProcessing(true);

    const context: CopilotUserContext = copilotContextService.buildContext(
      currentUser,
      currentRole,
      activeTenant,
      activeTab
    );

    try {
      const response = await copilotService.sendMessage({
        message: query,
        context,
        liveTelemetry: telemetry,
        alarmsList: alarms,
        equipmentList,
        activeTenant,
        history: messages.slice(-4).map((m) => ({
          sender: m.sender === "user" ? "user" : "copilot",
          text: m.text,
        })),
      });

      const copilotMessage: CopilotChatMessage = {
        id: `msg-copilot-${Date.now()}`,
        sender: "copilot",
        text: response.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        intent: response.intent,
        sources: response.sources,
        widgets: response.widgets,
        actions: response.actions,
        requiresConfirmation: response.requiresConfirmation,
        confirmationDetails: response.confirmationDetails,
      };

      setMessages((prev) => [...prev, copilotMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: "copilot",
          text: `⚠️ No se pudo completar la consulta: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Action execution (Navigation, Modals, etc.)
  const handleExecuteAction = (action: CopilotAction) => {
    if (action.type === "NAVIGATE" && action.payload?.targetRoute) {
      onNavigate(action.payload.targetRoute as NavigationTab);
    } else if (action.type === "OPEN_LINEAGE" && action.payload?.lineage && onOpenLineageModal) {
      onOpenLineageModal(action.payload.lineage);
    } else if (action.type === "OPEN_EQUIPMENT") {
      onNavigate("equipment");
    } else if (action.type === "ACKNOWLEDGE_ALARM" && action.payload?.alarmId && onAcknowledgeAlarm) {
      onAcknowledgeAlarm(action.payload.alarmId);
    }
  };

  // Handle Level 2/3 Action Confirmation
  const handleConfirmAction = (payload: Record<string, any>) => {
    if (payload.alarmId && onAcknowledgeAlarm) {
      onAcknowledgeAlarm(payload.alarmId);
    } else if (payload.tag && payload.value !== undefined && onUpdateSetpoint) {
      onUpdateSetpoint(payload.tag, payload.value);
    } else if (payload.exportMW !== undefined && onDispatchUpdate) {
      onDispatchUpdate(payload.exportMW);
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-ack-${Date.now()}`,
        sender: "copilot",
        text: `✅ **Operación ejecutada con éxito**. Se aplicó la instrucción y quedó registrada en la bitácora de auditoría de **${activeTenant.name}**.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <>
      {/* 1. Floating Trigger Button */}
      <button
        onClick={onToggleOpen}
        className={`fixed ${
          isFooterPinned ? "bottom-11 sm:bottom-12" : "bottom-6"
        } right-6 z-50 p-3.5 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center gap-2 font-mono text-xs font-bold ${
          isOpen
            ? "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:brightness-110 shadow-cyan-500/20 scale-100 hover:scale-105"
        }`}
        title="Abrir BioAzúcar Copilot AI"
      >
        <Sparkles className="w-5 h-5 animate-pulse" />
        {!isOpen && <span className="hidden sm:inline font-sans">Copilot AI</span>}
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute top-1 right-1"></span>
      </button>

      {/* 2. Slide-over Side Drawer */}
      {isOpen && (
        <aside
          className={`fixed inset-y-0 right-0 z-[110] bg-slate-950/95 border-l border-slate-800 backdrop-blur-xl shadow-2xl flex flex-col transition-all duration-300 ${
            isExpanded ? "w-full md:w-[680px]" : "w-full sm:w-[460px]"
          }`}
        >
          {/* Drawer Header */}
          <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white font-tech">BioAzúcar Copilot</h3>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    ONLINE
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono block truncate max-w-[220px]">
                  {activeTenant.name} ({activeTenant.code})
                </span>
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsAuditModalOpen(true)}
                title="Auditoría & Métricas"
                className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-cyan-300 transition"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? "Reducir" : "Expandir"}
                className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white transition hidden sm:block"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={onToggleOpen}
                title="Cerrar"
                className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Context Bar */}
          <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-900 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span className="truncate">
              Módulo: <strong className="text-cyan-400">{activeTab.toUpperCase()}</strong> • Rol: <strong className="text-slate-200">{currentRole}</strong>
            </span>
            <span className="text-emerald-400 flex items-center gap-1 font-bold">
              <Activity className="w-3 h-3" /> {telemetry.tch} TCH
            </span>
          </div>

          {/* Chat Messages List */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {messages.map((msg) => (
              <CopilotMessage
                key={msg.id}
                message={msg}
                onExecuteAction={handleExecuteAction}
                onConfirmAction={handleConfirmAction}
                onCancelConfirmation={() => {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `msg-cancel-${Date.now()}`,
                      sender: "copilot",
                      text: "Operación cancelada por el usuario.",
                      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    },
                  ]);
                }}
                onOpenLineage={() => onNavigate("dashboard")}
                onOpenEquipment={() => onNavigate("equipment")}
                onRequestAcknowledge={(id) => onAcknowledgeAlarm?.(id)}
              />
            ))}

            {isProcessing && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 font-mono">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Consultando modelo industrial y telemetría...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Contextual Quick Actions */}
          <CopilotQuickActions
            currentModule={activeTab}
            onSelectAction={(prompt) => handleSendMessage(prompt)}
          />

          {/* Message Input Footer */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Pregunta o comanda: Ej: 'Linaje de OEE', 'Vapor HP', 'Alarma Molino 3'..."
                disabled={isProcessing}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans shadow-inner"
              />
              <button
                type="submit"
                disabled={!inputPrompt.trim() || isProcessing}
                className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition shadow-md shadow-cyan-900/30 flex items-center justify-center"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </aside>
      )}

      {/* 3. Security Audit & Latency Modal */}
      <CopilotAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />
    </>
  );
};
