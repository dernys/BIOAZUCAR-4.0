import { CommandExecutionContract } from "./types";
import { policyEngine } from "./PolicyEngine";
import { UserRole } from "../../types";
import { logAuditEventToDb } from "../dbService";

export interface SubmitCommandParams {
  idempotencyKey?: string;
  userId: string;
  userName: string;
  role: UserRole;
  plantId: string;
  assetId: string;
  tag: string;
  oldValue: number | string | boolean;
  requestedValue: number | string | boolean;
  unit: string;
  reason: string;
  accessMode?: "READ" | "READ_WRITE" | "CONTROL";
  engMin?: number;
  engMax?: number;
  requireConfirmation?: boolean;
}

export interface CommandDispatcher {
  dispatchWrite(contract: CommandExecutionContract): Promise<{
    success: boolean;
    message: string;
    source: any;
    protocol: any;
  }>;
}

export class CommandService {
  private static instance: CommandService;
  private commandHistory: Map<string, CommandExecutionContract> = new Map();
  private idempotencyCache: Map<string, string> = new Map(); // idempotencyKey -> commandId
  private edgeDispatcher: CommandDispatcher | null = null;

  public static getInstance(): CommandService {
    if (!CommandService.instance) {
      CommandService.instance = new CommandService();
    }
    return CommandService.instance;
  }

  public registerDispatcher(dispatcher: CommandDispatcher): void {
    this.edgeDispatcher = dispatcher;
  }

  /**
   * Submits an industrial command through the secure pipeline:
   * Copilot/UI -> Command Service -> Policy Engine -> Validation -> Confirmation -> Queue -> Edge -> Connector
   */
  public async submitCommand(params: SubmitCommandParams): Promise<CommandExecutionContract> {
    const idempotencyKey =
      params.idempotencyKey ||
      `idemp-${params.userId}-${params.tag}-${params.requestedValue}-${Math.floor(Date.now() / 15000)}`;

    // 1. Check Idempotency Cache
    if (this.idempotencyCache.has(idempotencyKey)) {
      const existingId = this.idempotencyCache.get(idempotencyKey)!;
      const existingCmd = this.commandHistory.get(existingId);
      if (existingCmd) {
        return existingCmd;
      }
    }

    const commandId = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const operationalPermissions = policyEngine.getDefaultOperationalPermissions(params.role);

    const contract: CommandExecutionContract = {
      commandId,
      idempotencyKey,
      userId: params.userId,
      userName: params.userName,
      role: params.role,
      operationalPermission: operationalPermissions.includes("CONTROL")
        ? "CONTROL"
        : operationalPermissions.includes("OPERATE")
        ? "OPERATE"
        : "READ",
      plantId: params.plantId,
      assetId: params.assetId,
      tag: params.tag,
      oldValue: params.oldValue,
      requestedValue: params.requestedValue,
      unit: params.unit,
      reason: params.reason,
      timestamp: new Date().toISOString(),
      approval: {
        required: params.requireConfirmation !== false,
        status: "PENDING",
      },
      validationStatus: "PENDING",
      executionStatus: "QUEUED",
    };

    this.commandHistory.set(commandId, contract);
    this.idempotencyCache.set(idempotencyKey, commandId);

    // 2. Policy Engine & Range Validation
    const policyResult = policyEngine.evaluate({
      actor: {
        userId: params.userId,
        userName: params.userName,
        role: params.role,
        operationalPermissions,
        tenantId: params.plantId,
      },
      target: {
        tenantId: params.plantId,
        areaId: "AREA_DEFAULT",
        assetId: params.assetId,
        tag: params.tag,
        accessMode: params.accessMode || "READ_WRITE",
        engMin: params.engMin,
        engMax: params.engMax,
      },
      operation: {
        actionType: "CHANGE_SETPOINT",
        requestedValue: params.requestedValue,
        currentValue: params.oldValue,
      },
    });

    if (!policyResult.allowed) {
      contract.validationStatus = "INVALID";
      contract.validationMessage = policyResult.reason;
      contract.executionStatus = "FAILED";
      contract.result = {
        success: false,
        message: policyResult.reason || "Rechazado por política de seguridad operacional.",
        executionTimestamp: new Date().toISOString(),
        source: "EDGE",
        protocol: "SIMULATOR",
      };

      await this.logAudit(contract, "REJECTED_BY_POLICY");
      return contract;
    }

    contract.validationStatus = "VALID";

    // 3. Check if human supervisor confirmation is required
    if (contract.approval.required) {
      contract.executionStatus = "PENDING_CONFIRMATION";
      await this.logAudit(contract, "AWAITING_CONFIRMATION");
      return contract;
    }

    // 4. Auto-execute if pre-approved or confirmation bypassed by policy
    return await this.executeCommandInternal(contract);
  }

  /**
   * Human operator or supervisor confirms and approves the pending command.
   */
  public async confirmAndExecuteCommand(
    commandId: string,
    approver: { userId: string; role: UserRole; name: string }
  ): Promise<CommandExecutionContract> {
    const contract = this.commandHistory.get(commandId);
    if (!contract) {
      throw new Error(`Comando con ID ${commandId} no encontrado.`);
    }

    if (contract.executionStatus !== "PENDING_CONFIRMATION") {
      return contract;
    }

    // Verify approver permissions (must have OPERATE or CONTROL)
    const perms = policyEngine.getDefaultOperationalPermissions(approver.role);
    if (!perms.includes("OPERATE") && !perms.includes("CONTROL") && !perms.includes("ADMIN")) {
      contract.approval.status = "REJECTED";
      contract.executionStatus = "FAILED";
      contract.result = {
        success: false,
        message: `Aprobador ${approver.name} carece de permiso operacional para confirmar este comando.`,
        executionTimestamp: new Date().toISOString(),
        source: "EDGE",
        protocol: "SIMULATOR",
      };
      await this.logAudit(contract, "CONFIRMATION_DENIED");
      return contract;
    }

    contract.approval.status = "APPROVED";
    contract.approval.approverUserId = approver.userId;
    contract.approval.approverRole = approver.role;
    contract.approval.approvedAt = new Date().toISOString();

    return await this.executeCommandInternal(contract);
  }

  /**
   * Cancel a pending command
   */
  public cancelCommand(commandId: string, reason: string): CommandExecutionContract | null {
    const contract = this.commandHistory.get(commandId);
    if (!contract) return null;

    contract.executionStatus = "CANCELLED";
    contract.result = {
      success: false,
      message: `Comando cancelado: ${reason}`,
      executionTimestamp: new Date().toISOString(),
      source: "EDGE",
      protocol: "SIMULATOR",
    };
    return contract;
  }

  private async executeCommandInternal(contract: CommandExecutionContract): Promise<CommandExecutionContract> {
    contract.executionStatus = "EXECUTING";

    try {
      if (!this.edgeDispatcher) {
        throw new Error("No hay un despachador Industrial Edge registrado para ejecutar comandos físicos.");
      }

      const dispatchRes = await this.edgeDispatcher.dispatchWrite(contract);

      contract.executionStatus = dispatchRes.success ? "EXECUTED" : "FAILED";
      contract.result = {
        success: dispatchRes.success,
        message: dispatchRes.message,
        executionTimestamp: new Date().toISOString(),
        source: dispatchRes.source || "EDGE",
        protocol: dispatchRes.protocol || "SIMULATOR",
      };

      await this.logAudit(contract, dispatchRes.success ? "EXECUTED_SUCCESS" : "EXECUTION_ERROR");
      return contract;
    } catch (err: any) {
      contract.executionStatus = "FAILED";
      contract.result = {
        success: false,
        message: `Fallo en capa Edge al despachar comando a bus OT: ${err.message}`,
        executionTimestamp: new Date().toISOString(),
        source: "EDGE",
        protocol: "SIMULATOR",
      };

      await this.logAudit(contract, "EXECUTION_EXCEPTION");
      return contract;
    }
  }

  private async logAudit(contract: CommandExecutionContract, eventTag: string): Promise<void> {
    try {
      await logAuditEventToDb({
        timestamp: new Date().toISOString(),
        userRole: contract.role as any,
        userName: contract.userName,
        action: "COMMAND_SERVICE_DISPATCH",
        module: "INDUSTRIAL_EDGE",
        targetId: contract.tag,
        previousValue: String(contract.oldValue),
        newValue: JSON.stringify({
          commandId: contract.commandId,
          eventTag,
          requestedValue: contract.requestedValue,
          status: contract.executionStatus,
          idempotencyKey: contract.idempotencyKey,
        }),
        status: contract.executionStatus === "EXECUTED" ? "EXECUTED" : "AUTHORIZED",
        ipAddress: "127.0.0.1",
        tenantId: contract.plantId,
      });
    } catch (e) {
      console.warn("Could not log command audit event:", e);
    }
  }

  /**
   * Convenience execution method for Edge console, Copilot tools, and DataProviders
   * Enforces strict SEC-8 safety ranges and verified actor roles
   */
  public async executeCommand(
    params: {
      tag: string;
      commandType?: string;
      requestedValue: any;
      operatorId?: string;
      role?: UserRole;
      tenantId?: string;
      reason?: string;
      clientIp?: string;
      securityClearanceLevel?: number;
      engMin?: number;
      engMax?: number;
    },
    operatorConfirmed: boolean = true
  ): Promise<{
    status: "EXECUTED" | "PENDING_CONFIRMATION" | "REJECTED" | "FAILED";
    message: string;
    correlationId: string;
    idempotencyKey: string;
    contract: CommandExecutionContract;
  }> {
    // Derive engineering limits if not explicitly provided
    let engMin = params.engMin;
    let engMax = params.engMax;
    const tagUpper = params.tag.toUpperCase();
    if (engMin === undefined && engMax === undefined) {
      if (tagUpper.includes("TCH")) {
        engMin = 0;
        engMax = 600;
      } else if (tagUpper.includes("PRESS") || tagUpper.includes("BAR")) {
        engMin = 0;
        engMax = 90;
      } else if (tagUpper.includes("MW") || tagUpper.includes("POWER") || tagUpper.includes("DISPATCH")) {
        engMin = 0;
        engMax = 60;
      } else if (tagUpper.includes("BRIX") || tagUpper.includes("EXTRACTION") || tagUpper.includes("PERCENT")) {
        engMin = 0;
        engMax = 100;
      }
    }

    const role: UserRole = params.role || "operador";
    const plantId = params.tenantId || "tenant-bioazucar-01";

    const submitRes = await this.submitCommand({
      userId: params.operatorId || "OP-SYS",
      userName: params.operatorId || "Operador Industrial",
      role,
      plantId,
      assetId: "eq-process",
      tag: params.tag,
      oldValue: 0,
      requestedValue: params.requestedValue,
      unit: "",
      reason: params.reason || "Ajuste operacional de consigna de proceso",
      accessMode: "CONTROL",
      engMin,
      engMax,
      requireConfirmation: !operatorConfirmed,
    });

    if (submitRes.executionStatus === "PENDING_CONFIRMATION" && operatorConfirmed) {
      const confirmedRes = await this.confirmAndExecuteCommand(submitRes.commandId, {
        userId: params.operatorId || "OP-SYS",
        name: params.operatorId || "Operador Industrial",
        role,
      });

      return {
        status: confirmedRes.executionStatus as any,
        message: confirmedRes.result?.message || "Comando ejecutado y despachado con éxito al Edge.",
        correlationId: confirmedRes.commandId,
        idempotencyKey: confirmedRes.idempotencyKey,
        contract: confirmedRes,
      };
    }

    return {
      status: submitRes.executionStatus as any,
      message:
        submitRes.result?.message ||
        submitRes.validationMessage ||
        (submitRes.executionStatus === "PENDING_CONFIRMATION"
          ? "Comando en espera de confirmación de supervisor."
          : "Comando procesado por CommandService."),
      correlationId: submitRes.commandId,
      idempotencyKey: submitRes.idempotencyKey,
      contract: submitRes,
    };
  }

  public getCommandById(id: string): CommandExecutionContract | null {
    return this.commandHistory.get(id) || null;
  }

  public getCommandHistory(limit: number = 50): CommandExecutionContract[] {
    return Array.from(this.commandHistory.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  public getAuditTrail(limit: number = 50): CommandExecutionContract[] {
    return this.getCommandHistory(limit);
  }

  public getPendingCommands(): CommandExecutionContract[] {
    return Array.from(this.commandHistory.values()).filter(
      (c) => c.executionStatus === "PENDING_CONFIRMATION"
    );
  }
}

export const commandService = CommandService.getInstance();
