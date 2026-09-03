import React from "react";
import {
  Sparkles,
  User,
  Layers,
  ArrowRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Database,
  ExternalLink,
} from "lucide-react";
import {
  CopilotChatMessage,
  CopilotAction,
  ActionConfirmationRequest,
} from "../domain/CopilotTypes";
import { CopilotWidgetsRenderer } from "./CopilotWidgets";
import { CopilotConfirmation } from "./CopilotConfirmation";

interface CopilotMessageProps {
  message: CopilotChatMessage;
  onExecuteAction?: (action: CopilotAction) => void;
  onConfirmAction?: (payload: Record<string, any>) => void;
  onCancelConfirmation?: () => void;
  onOpenLineage?: (kpiId: string) => void;
  onOpenEquipment?: (equipmentId: string) => void;
  onRequestAcknowledge?: (alarmId: string) => void;
}

export const CopilotMessage: React.FC<CopilotMessageProps> = ({
  message,
  onExecuteAction,
  onConfirmAction,
  onCancelConfirmation,
  onOpenLineage,
  onOpenEquipment,
  onRequestAcknowledge,
}) => {
  const isUser = message.sender === "user";

  return (
    <div
      className={`flex gap-2.5 p-3 rounded-2xl text-xs transition-all ${
        isUser
          ? "bg-cyan-950/30 border border-cyan-800/40 text-cyan-100 ml-6"
          : "bg-slate-900/90 border border-slate-800/90 text-slate-200 mr-2 shadow-sm"
      }`}
    >
      {/* Sender Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isUser
            ? "bg-cyan-600 text-white font-bold"
            : "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>

      <div className="flex-1 overflow-hidden space-y-2">
        {/* Header (Sender name + Timestamp) */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="font-bold text-slate-300">
            {isUser ? "Tú (Operador)" : "BioAzúcar Copilot AI"}
          </span>
          <span>{message.timestamp}</span>
        </div>

        {/* Text Body formatted */}
        <div className="prose prose-invert prose-xs max-w-none text-slate-200 leading-relaxed font-sans space-y-1.5 whitespace-pre-wrap">
          {message.text}
        </div>

        {/* Embedded Interactive Widgets */}
        {message.widgets && message.widgets.length > 0 && (
          <div className="space-y-2 pt-1">
            {message.widgets.map((w, idx) => (
              <CopilotWidgetsRenderer
                key={idx}
                widget={w}
                onOpenLineage={onOpenLineage}
                onOpenEquipment={onOpenEquipment}
                onRequestAcknowledge={onRequestAcknowledge}
              />
            ))}
          </div>
        )}

        {/* Confirmation Dialog if required */}
        {message.requiresConfirmation && message.confirmationDetails && onConfirmAction && onCancelConfirmation && (
          <CopilotConfirmation
            request={message.confirmationDetails}
            onConfirm={onConfirmAction}
            onCancel={onCancelConfirmation}
          />
        )}

        {/* Data Source Provenance & Lineage Footer */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-1 text-slate-300 font-bold mb-1">
              <Database className="w-3 h-3 text-cyan-400" />
              <span>Fuentes de Datos Consultadas ({message.sources.length}):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.sources.map((s, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1"
                >
                  <strong className="text-cyan-300">{s.name}:</strong> {s.value} {s.unit} ({s.source} • {s.quality})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {message.actions && message.actions.length > 0 && onExecuteAction && (
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            {message.actions.map((act) => (
              <button
                key={act.id}
                onClick={() => onExecuteAction(act)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold transition shadow-sm"
              >
                <span>{act.label}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
