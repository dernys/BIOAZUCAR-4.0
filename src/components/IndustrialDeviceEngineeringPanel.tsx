import React, { useState } from "react";
import {
  Cpu,
  Plus,
  Edit2,
  Trash2,
  Search,
  RefreshCw,
  Server,
  Layers,
  CheckCircle2,
  AlertTriangle,
  X,
  Radio,
  Sliders,
} from "lucide-react";
import {
  IndustrialDeviceDefinition,
  IndustrialDeviceType,
  ConnectionRegistryEntry,
  UserRole,
} from "../types";
import { industrialDeviceRegistry } from "../services/dataProviders/IndustrialDeviceRegistry";

interface IndustrialDeviceEngineeringPanelProps {
  connection: Partial<ConnectionRegistryEntry>;
  devices: IndustrialDeviceDefinition[];
  selectedDeviceId?: string;
  theme?: "light" | "dark";
  userRole?: UserRole;
  onDevicesChange: (devices: IndustrialDeviceDefinition[]) => void;
  onSelectDevice: (deviceId: string) => void;
}

export const IndustrialDeviceEngineeringPanel: React.FC<IndustrialDeviceEngineeringPanelProps> = ({
  connection,
  devices,
  selectedDeviceId,
  theme = "dark",
  userRole = "administrador",
  onDevicesChange,
  onSelectDevice,
}) => {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Partial<IndustrialDeviceDefinition> | null>(null);

  const handleDiscoverDevices = async () => {
    setIsDiscovering(true);
    try {
      if (connection.id) {
        const discovered = await industrialDeviceRegistry.discoverDevicesFromConnection(
          connection.id,
          connection.protocol || "OPC_UA"
        );
        // Merge with existing devices, avoiding duplicate IDs
        const existingIds = new Set(devices.map((d) => d.id));
        const newOnes = discovered.filter((d) => !existingIds.has(d.id));
        const merged = [...devices, ...newOnes];
        onDevicesChange(merged);
        if (merged.length > 0 && !selectedDeviceId) {
          onSelectDevice(merged[0].id);
        }
      }
    } catch (e: any) {
      alert(`Error en descubrimiento de dispositivos: ${e.message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleOpenAddDevice = () => {
    const draft: Partial<IndustrialDeviceDefinition> = {
      id: `dev-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: "Nuevo Dispositivo de Control",
      connectionId: connection.id || "",
      tenantId: connection.tenantId || "",
      siteId: connection.siteId || "SITE_CENTRAL_01",
      areaId: connection.areaId || "AREA_MOLIENDA",
      assetId: "eq-molino-1",
      deviceType: "PLC",
      vendor: "Siemens / Allen-Bradley",
      model: "S7-1500 / ControlLogix",
      firmwareVersion: "v2.8.4",
      ipAddress: "192.168.10.50",
      busAddress: "1",
      rack: 0,
      slot: 1,
      status: "CONFIGURED",
      criticality: "HIGH",
      tagsCount: 0,
    };
    setEditingDevice(draft);
    setIsEditorOpen(true);
  };

  const handleEditDevice = (device: IndustrialDeviceDefinition) => {
    setEditingDevice({ ...device });
    setIsEditorOpen(true);
  };

  const handleDeleteDevice = (deviceId: string) => {
    if (confirm("¿Confirmar eliminación de este dispositivo y su mapeo asociado?")) {
      const remaining = devices.filter((d) => d.id !== deviceId);
      onDevicesChange(remaining);
      if (selectedDeviceId === deviceId) {
        onSelectDevice(remaining[0]?.id || "");
      }
    }
  };

  const handleSaveDevice = () => {
    if (!editingDevice || !editingDevice.name) return;
    const completeDevice: IndustrialDeviceDefinition = {
      ...(editingDevice as IndustrialDeviceDefinition),
      id: editingDevice.id || `dev-${Date.now()}`,
      name: editingDevice.name,
      connectionId: connection.id || "",
      tenantId: connection.tenantId || "",
      siteId: connection.siteId || "SITE_CENTRAL_01",
      areaId: connection.areaId || "AREA_MOLIENDA",
      assetId: editingDevice.assetId || "eq-molino-1",
      deviceType: editingDevice.deviceType || "PLC",
      status: editingDevice.status || "CONFIGURED",
      criticality: editingDevice.criticality || "MEDIUM",
      tagsCount: editingDevice.tagsCount || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const exists = devices.some((d) => d.id === completeDevice.id);
    if (exists) {
      onDevicesChange(devices.map((d) => (d.id === completeDevice.id ? completeDevice : d)));
    } else {
      onDevicesChange([...devices, completeDevice]);
      if (!selectedDeviceId) {
        onSelectDevice(completeDevice.id);
      }
    }
    setIsEditorOpen(false);
    setEditingDevice(null);
  };

  return (
    <div className={`space-y-4 ${theme === "dark" ? "dark" : ""}`}>
      {/* Header and Toolbar */}
      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
        <div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Dispositivos Industriales Asociados ({devices.length})
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Jerarquía ISA-95: Connection → Device (PLC/DCS/VFD) → Tags
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDiscoverDevices}
            disabled={isDiscovering}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 rounded text-xs font-medium flex items-center gap-1.5 shadow-sm"
          >
            {isDiscovering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Descubrir Dispositivos
          </button>
          <button
            onClick={handleOpenAddDevice}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar Dispositivo
          </button>
        </div>
      </div>

      {/* Grid of Devices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {devices.map((device) => {
          const isSelected = selectedDeviceId === device.id;
          return (
            <div
              key={device.id}
              onClick={() => onSelectDevice(device.id)}
              className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                isSelected
                  ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 shadow-sm ring-1 ring-emerald-500/50"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center ${
                      isSelected
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                      {device.name}
                    </h5>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {device.deviceType} • {device.vendor || "Genérico"}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    device.status === "ONLINE"
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                      : "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300"
                  }`}
                >
                  {device.status}
                </span>
              </div>

              <div className="space-y-1 text-[11px] font-mono text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                <div className="flex justify-between">
                  <span>Dirección / IP:</span>
                  <span className="text-slate-900 dark:text-slate-200 font-semibold">{device.ipAddress || device.busAddress || "127.0.0.1"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Modelo / FW:</span>
                  <span className="truncate max-w-[120px] text-right">{device.model || "PLC-Industrial"} ({device.firmwareVersion || "v1.0"})</span>
                </div>
                <div className="flex justify-between">
                  <span>Tags Asociados:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{device.tagsCount || 0}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/60">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditDevice(device);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                  title="Editar parámetros del dispositivo"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDevice(device.id);
                  }}
                  className="p-1 text-slate-400 hover:text-red-500 rounded"
                  title="Eliminar dispositivo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Device Editor Modal */}
      {isEditorOpen && editingDevice && (
        <div className="fixed inset-0 z-[150] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Configuración de Dispositivo Físico / Lógico
                </h3>
              </div>
              <button onClick={() => setIsEditorOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Nombre del Dispositivo *
                </label>
                <input
                  type="text"
                  value={editingDevice.name || ""}
                  onChange={(e) => setEditingDevice({ ...editingDevice, name: e.target.value })}
                  placeholder="PLC-TANDEM-01"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                    Tipo de Dispositivo
                  </label>
                  <select
                    value={editingDevice.deviceType || "PLC"}
                    onChange={(e) =>
                      setEditingDevice({ ...editingDevice, deviceType: e.target.value as IndustrialDeviceType })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-900 dark:text-white"
                  >
                    <option value="PLC">PLC (Controlador Lógico Programable)</option>
                    <option value="DCS">DCS (Sistema de Control Distribuido)</option>
                    <option value="RTU">RTU (Unidad Terminal Remota)</option>
                    <option value="SMART_TRANSMITTER">Transmisor Inteligente (HART/Fieldbus)</option>
                    <option value="DRIVE_VFD">Variador de Frecuencia (VFD)</option>
                    <option value="POWER_METER">Medidor de Energía / Red</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                    Fabricante (Vendor)
                  </label>
                  <input
                    type="text"
                    value={editingDevice.vendor || ""}
                    onChange={(e) => setEditingDevice({ ...editingDevice, vendor: e.target.value })}
                    placeholder="Siemens, Rockwell, Schneider"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={editingDevice.model || ""}
                    onChange={(e) => setEditingDevice({ ...editingDevice, model: e.target.value })}
                    placeholder="S7-1518, ControlLogix 5580"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                    Firmware
                  </label>
                  <input
                    type="text"
                    value={editingDevice.firmwareVersion || ""}
                    onChange={(e) => setEditingDevice({ ...editingDevice, firmwareVersion: e.target.value })}
                    placeholder="v3.1.2"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                    Dirección IP / Host
                  </label>
                  <input
                    type="text"
                    value={editingDevice.ipAddress || ""}
                    onChange={(e) => setEditingDevice({ ...editingDevice, ipAddress: e.target.value })}
                    placeholder="192.168.10.50"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                    Rack / Slot / Modbus ID
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      placeholder="Rack"
                      value={editingDevice.rack ?? 0}
                      onChange={(e) => setEditingDevice({ ...editingDevice, rack: parseInt(e.target.value, 10) || 0 })}
                      className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 font-mono text-slate-900 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Slot/ID"
                      value={editingDevice.slot ?? 1}
                      onChange={(e) => setEditingDevice({ ...editingDevice, slot: parseInt(e.target.value, 10) || 1 })}
                      className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsEditorOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDevice}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow-sm"
              >
                Guardar Dispositivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
