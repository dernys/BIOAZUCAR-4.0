import React, { useState } from "react";
import {
  Plus,
  Edit2,
  Copy,
  Trash2,
  Search,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sliders,
  Filter,
  CheckSquare,
  Square,
  RefreshCw,
  X,
  FileSpreadsheet,
} from "lucide-react";
import {
  IndustrialTagDefinition,
  IndustrialDeviceDefinition,
  TagDataType,
  TagSignedness,
  TagEndianness,
  TagSamplingMode,
  UserRole,
} from "../types";
import { validateIndustrialTagDefinition } from "../services/dataProviders/IndustrialRegistryValidator";

interface IndustrialTagEngineeringGridProps {
  tags: IndustrialTagDefinition[];
  devices: IndustrialDeviceDefinition[];
  selectedDeviceId?: string;
  theme?: "light" | "dark";
  userRole?: UserRole;
  onTagsChange: (tags: IndustrialTagDefinition[]) => void;
  onTestTag?: (tag: IndustrialTagDefinition) => void;
  onDiscoverFromDevice?: (deviceId: string) => void;
}

export const IndustrialTagEngineeringGrid: React.FC<IndustrialTagEngineeringGridProps> = ({
  tags,
  devices,
  selectedDeviceId,
  theme = "dark",
  userRole = "administrador",
  onTagsChange,
  onTestTag,
  onDiscoverFromDevice,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDevice, setFilterDevice] = useState<string>(selectedDeviceId || "ALL");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [editingTag, setEditingTag] = useState<Partial<IndustrialTagDefinition> | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [validationErrors, setValidationErrors] = useState<{ tagId: string; errors: string[] }[]>([]);

  // Filtered list
  const filteredTags = tags.filter((t) => {
    const matchesSearch =
      (t.canonicalName || t.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.sourceAddress || t.address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.unit || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDevice = filterDevice === "ALL" || t.deviceId === filterDevice;
    return matchesSearch && matchesDevice;
  });

  const toggleSelectAll = () => {
    if (selectedTagIds.size === filteredTags.length) {
      setSelectedTagIds(new Set());
    } else {
      setSelectedTagIds(new Set(filteredTags.map((t) => t.id)));
    }
  };

  const toggleSelectTag = (id: string) => {
    const next = new Set(selectedTagIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTagIds(next);
  };

  // Tag Operations
  const handleAddNewTag = () => {
    const activeDevice = devices.find((d) => d.id === filterDevice) || devices[0];
    const newDraft: Partial<IndustrialTagDefinition> = {
      id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      canonicalName: "NUEVO_TAG",
      displayName: "Nuevo Tag de Ingeniería",
      sourceAddress: "ns=2;s=Device.Variable",
      deviceId: activeDevice?.id || "",
      deviceName: activeDevice?.name || "",
      areaId: activeDevice?.areaId || "AREA_MOLIENDA",
      assetId: activeDevice?.assetId || "eq-molino-1",
      protocol: "OPC_UA",
      dataType: "FLOAT",
      signedness: "SIGNED",
      endianness: "BIG_ENDIAN",
      scale: 1,
      offset: 0,
      engMin: 0,
      engMax: 100,
      unit: "bar",
      readable: true,
      writable: false,
      accessMode: "READ",
      samplingMode: "SUBSCRIPTION",
      samplingIntervalMs: 1000,
      deadband: 0.1,
      staleTimeoutMs: 5000,
      historianEnabled: true,
      dashboardEnabled: true,
      aiEnabled: true,
      enabled: true,
      status: "ACTIVE",
    };
    setEditingTag(newDraft);
    setIsEditorOpen(true);
  };

  const handleEditTag = (tag: IndustrialTagDefinition) => {
    setEditingTag({ ...tag });
    setIsEditorOpen(true);
  };

  const handleDuplicateTag = (tag: IndustrialTagDefinition) => {
    const copy: IndustrialTagDefinition = {
      ...tag,
      id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      canonicalName: `${tag.canonicalName || tag.name || "TAG"}_COPIA`,
      displayName: `${tag.displayName || tag.name || "Tag"} (Copia)`,
      sourceAddress: `${tag.sourceAddress || tag.address || ""}_copy`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onTagsChange([...tags, copy]);
  };

  const handleDeleteTag = (tagId: string) => {
    if (confirm("¿Confirmar eliminación de este tag del catálogo de ingeniería?")) {
      onTagsChange(tags.filter((t) => t.id !== tagId));
      selectedTagIds.delete(tagId);
      setSelectedTagIds(new Set(selectedTagIds));
    }
  };

  const handleBulkDelete = () => {
    if (selectedTagIds.size === 0) return;
    if (confirm(`¿Eliminar los ${selectedTagIds.size} tags seleccionados?`)) {
      onTagsChange(tags.filter((t) => !selectedTagIds.has(t.id)));
      setSelectedTagIds(new Set());
    }
  };

  const handleBulkToggleHistorian = () => {
    if (selectedTagIds.size === 0) return;
    const updated = tags.map((t) => {
      if (selectedTagIds.has(t.id)) {
        return { ...t, historianEnabled: !t.historianEnabled };
      }
      return t;
    });
    onTagsChange(updated);
  };

  const handleBulkSetScanRate = (rateMs: number) => {
    if (selectedTagIds.size === 0) return;
    const updated = tags.map((t) => {
      if (selectedTagIds.has(t.id)) {
        return { ...t, samplingIntervalMs: rateMs, scanRateMs: rateMs };
      }
      return t;
    });
    onTagsChange(updated);
  };

  const handleValidateAllTags = () => {
    const errorsList: { tagId: string; errors: string[] }[] = [];
    tags.forEach((t) => {
      const v = validateIndustrialTagDefinition(t);
      if (!v.isValid) {
        errorsList.push({
          tagId: t.canonicalName || t.name || t.id,
          errors: v.errors || (v as any).reasons || [],
        });
      }
    });
    setValidationErrors(errorsList);
    if (errorsList.length === 0) {
      alert("✓ Todos los tags configurados cumplen con las normas ISA-95 e IEC 62443.");
    }
  };

  const handleSaveEditor = () => {
    if (!editingTag) return;
    const completeTag: IndustrialTagDefinition = {
      ...(editingTag as IndustrialTagDefinition),
      id: editingTag.id || `tag-${Date.now()}`,
      canonicalName: editingTag.canonicalName || "TAG_UNDEFINED",
      displayName: editingTag.displayName || editingTag.canonicalName || "Tag",
      name: editingTag.canonicalName,
      address: editingTag.sourceAddress,
      sourceAddress: editingTag.sourceAddress || "ns=2;s=Default",
      accessMode: editingTag.writable ? "READ_WRITE" : "READ",
      scanRateMs: editingTag.samplingIntervalMs || 1000,
      engMin: editingTag.engMin ?? 0,
      engMax: editingTag.engMax ?? 100,
      unit: editingTag.unit || "",
      updatedAt: new Date().toISOString(),
    };

    const exists = tags.some((t) => t.id === completeTag.id);
    if (exists) {
      onTagsChange(tags.map((t) => (t.id === completeTag.id ? completeTag : t)));
    } else {
      onTagsChange([...tags, completeTag]);
    }
    setIsEditorOpen(false);
    setEditingTag(null);
  };

  const handleProcessImport = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (!Array.isArray(parsed)) {
        alert("El contenido debe ser un arreglo JSON de tags.");
        return;
      }
      const importedTags: IndustrialTagDefinition[] = parsed.map((item, idx) => ({
        id: `tag-imp-${Date.now()}-${idx}`,
        canonicalName: item.canonicalName || item.name || `TAG_IMP_${idx + 1}`,
        displayName: item.displayName || item.name || `Tag Importado ${idx + 1}`,
        sourceAddress: item.sourceAddress || item.address || "ns=2;s=Var",
        protocol: item.protocol || "OPC_UA",
        dataType: item.dataType || "FLOAT",
        signedness: item.signedness || "SIGNED",
        endianness: item.endianness || "BIG_ENDIAN",
        scale: item.scale ?? 1,
        offset: item.offset ?? 0,
        engMin: item.engMin ?? 0,
        engMax: item.engMax ?? 100,
        unit: item.unit || "",
        accessMode: item.accessMode || "READ",
        readable: true,
        writable: item.accessMode === "READ_WRITE" || Boolean(item.writable),
        samplingMode: item.samplingMode || "SUBSCRIPTION",
        samplingIntervalMs: item.samplingIntervalMs || 1000,
        deadband: item.deadband ?? 0.1,
        staleTimeoutMs: item.staleTimeoutMs ?? 5000,
        historianEnabled: item.historianEnabled ?? true,
        dashboardEnabled: item.dashboardEnabled ?? true,
        aiEnabled: item.aiEnabled ?? true,
        status: "ACTIVE",
        enabled: true,
        deviceId: item.deviceId || devices[0]?.id,
        deviceName: item.deviceName || devices[0]?.name,
        areaId: item.areaId || "AREA_MOLIENDA",
        assetId: item.assetId || "eq-molino-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      onTagsChange([...tags, ...importedTags]);
      setIsImportModalOpen(false);
      setImportJsonText("");
      alert(`✓ Se importaron exitosamente ${importedTags.length} tags al catálogo.`);
    } catch (e: any) {
      alert(`Error al procesar JSON: ${e.message}`);
    }
  };

  return (
    <div className={`space-y-4 ${theme === "dark" ? "dark" : ""}`}>
      {/* Header and Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por nombre, dirección o unidad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white font-mono w-64 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Device Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterDevice}
              onChange={(e) => setFilterDevice(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
            >
              <option value="ALL">Todos los Dispositivos ({devices.length})</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.deviceType})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleAddNewTag}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar Tag
          </button>

          {onDiscoverFromDevice && filterDevice !== "ALL" && (
            <button
              onClick={() => onDiscoverFromDevice(filterDevice)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 rounded text-xs font-medium flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Descubrir en Dispositivo
            </button>
          )}

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 rounded text-xs font-medium flex items-center gap-1"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar
          </button>

          <button
            onClick={handleValidateAllTags}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium flex items-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Validar Todo
          </button>

          {selectedTagIds.size > 0 && (
            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5">
              <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300 font-bold">
                {selectedTagIds.size} selec.
              </span>
              <button
                onClick={handleBulkToggleHistorian}
                className="px-1.5 py-1 text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white rounded hover:bg-slate-300 dark:hover:bg-slate-700"
                title="Conmutar Historiador"
              >
                TSDB
              </button>
              <button
                onClick={() => handleBulkSetScanRate(1000)}
                className="px-1.5 py-1 text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white rounded hover:bg-slate-300 dark:hover:bg-slate-700"
                title="Establecer a 1000ms"
              >
                1s
              </button>
              <button
                onClick={handleBulkDelete}
                className="p-1 text-red-600 hover:text-red-700 dark:text-red-400"
                title="Eliminar seleccionados"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Validation Alert Banner */}
      {validationErrors.length > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg text-xs space-y-1">
          <div className="flex items-center justify-between text-red-800 dark:text-red-300 font-bold">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              Se detectaron {validationErrors.length} errores de validación en los tags:
            </span>
            <button
              onClick={() => setValidationErrors([])}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[11px] text-red-700 dark:text-red-300">
            {validationErrors.map((err, idx) => (
              <div key={idx}>
                <strong>{err.tagId}:</strong> {err.errors.join("; ")}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Tag Engineering Table Grid */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-2 w-8 text-center">
                  <button onClick={toggleSelectAll} className="p-0.5 text-slate-500 hover:text-slate-700">
                    {selectedTagIds.size === filteredTags.length && filteredTags.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                </th>
                <th className="p-2 min-w-[180px]">Nombre Canónico</th>
                <th className="p-2 min-w-[160px]">Dirección / Registro</th>
                <th className="p-2 min-w-[120px]">Dispositivo</th>
                <th className="p-2">Tipo / Endian</th>
                <th className="p-2">Rango Eng.</th>
                <th className="p-2">Unidad</th>
                <th className="p-2">Acceso</th>
                <th className="p-2">Muestreo</th>
                <th className="p-2 text-center">Flags</th>
                <th className="p-2 text-right min-w-[100px]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredTags.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 italic">
                    No hay variables industriales en esta vista. Agregue tags manualmente o descubra nodos del PLC.
                  </td>
                </tr>
              ) : (
                filteredTags.map((t) => {
                  const isSelected = selectedTagIds.has(t.id);
                  const isWritable = t.writable || t.accessMode === "READ_WRITE";
                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""
                      }`}
                    >
                      <td className="p-2 text-center">
                        <button
                          onClick={() => toggleSelectTag(t.id)}
                          className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                      <td className="p-2">
                        <div className="font-bold text-slate-900 dark:text-white truncate" title={t.canonicalName}>
                          {t.canonicalName || t.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {t.displayName || t.description || t.areaId}
                        </div>
                      </td>
                      <td className="p-2 text-emerald-700 dark:text-emerald-400 font-mono truncate" title={t.sourceAddress || t.address}>
                        {t.sourceAddress || t.address || "N/A"}
                      </td>
                      <td className="p-2 text-slate-700 dark:text-slate-300 truncate">
                        {t.deviceName || devices.find((d) => d.id === t.deviceId)?.name || t.deviceId || "General"}
                      </td>
                      <td className="p-2 text-slate-600 dark:text-slate-400">
                        <span className="font-semibold">{t.dataType || "FLOAT"}</span>
                        <span className="text-[10px] block opacity-70">
                          {t.signedness === "UNSIGNED" ? "UINT" : "INT"} • {t.endianness === "LITTLE_ENDIAN" ? "LE" : "BE"}
                        </span>
                      </td>
                      <td className="p-2 text-slate-700 dark:text-slate-300">
                        {t.engMin ?? 0} .. {t.engMax ?? 100}
                      </td>
                      <td className="p-2 font-bold text-slate-800 dark:text-slate-200">{t.unit || "-"}</td>
                      <td className="p-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isWritable
                              ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {isWritable ? "RW" : "RO"}
                        </span>
                      </td>
                      <td className="p-2 text-slate-600 dark:text-slate-400">
                        <div>{t.samplingIntervalMs || t.scanRateMs || 1000}ms</div>
                        <div className="text-[10px] opacity-70">{t.samplingMode || "SUB"}</div>
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span
                            title="Historian"
                            className={`w-2 h-2 rounded-full ${
                              t.historianEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                            }`}
                          />
                          <span
                            title="Dashboard"
                            className={`w-2 h-2 rounded-full ${
                              t.dashboardEnabled ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-700"
                            }`}
                          />
                          <span
                            title="BioAI Engine"
                            className={`w-2 h-2 rounded-full ${
                              t.aiEnabled ? "bg-purple-500" : "bg-slate-300 dark:bg-slate-700"
                            }`}
                          />
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onTestTag && (
                            <button
                              onClick={() => onTestTag(t)}
                              className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded"
                              title="Probar en Tester"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditTag(t)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded"
                            title="Editar Parámetros"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateTag(t)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded"
                            title="Duplicar Tag"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTag(t.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-950 text-red-600 dark:text-red-400 rounded"
                            title="Eliminar Tag"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tag Editor Modal */}
      {isEditorOpen && editingTag && (
        <div className="fixed inset-0 z-[150] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Ingeniería de Tag Industrial
                </h3>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid of properties */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Nombre Canónico *
                </label>
                <input
                  type="text"
                  value={editingTag.canonicalName || ""}
                  onChange={(e) => setEditingTag({ ...editingTag, canonicalName: e.target.value.toUpperCase() })}
                  placeholder="MOLINO_01.VELOCIDAD_RPM"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Nombre para Visualización (Display Name)
                </label>
                <input
                  type="text"
                  value={editingTag.displayName || ""}
                  onChange={(e) => setEditingTag({ ...editingTag, displayName: e.target.value })}
                  placeholder="Velocidad Angular Molino 1"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Dispositivo Físico Asociado
                </label>
                <select
                  value={editingTag.deviceId || ""}
                  onChange={(e) => {
                    const dev = devices.find((d) => d.id === e.target.value);
                    setEditingTag({
                      ...editingTag,
                      deviceId: e.target.value,
                      deviceName: dev?.name || "",
                      assetId: dev?.assetId || editingTag.assetId,
                      areaId: dev?.areaId || editingTag.areaId,
                    });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono"
                >
                  <option value="">-- Sin Dispositivo Específico --</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.vendor || "Genérico"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Dirección Física / NodeId *
                </label>
                <input
                  type="text"
                  value={editingTag.sourceAddress || ""}
                  onChange={(e) => setEditingTag({ ...editingTag, sourceAddress: e.target.value })}
                  placeholder="ns=2;s=Milling.Tandem.SpeedRPM"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-emerald-700 dark:text-emerald-400 font-mono"
                />
              </div>

              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Tipo de Dato
                </label>
                <select
                  value={editingTag.dataType || "FLOAT"}
                  onChange={(e) => setEditingTag({ ...editingTag, dataType: e.target.value as TagDataType })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono"
                >
                  <option value="FLOAT">FLOAT (32-bit Float)</option>
                  <option value="DOUBLE">DOUBLE (64-bit Float)</option>
                  <option value="INTEGER">INTEGER (32-bit Int)</option>
                  <option value="BOOLEAN">BOOLEAN (Digital 0/1)</option>
                  <option value="STRING">STRING (Texto Ascii)</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Signo & Endianness
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editingTag.signedness || "SIGNED"}
                    onChange={(e) => setEditingTag({ ...editingTag, signedness: e.target.value as TagSignedness })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-slate-900 dark:text-white font-mono"
                  >
                    <option value="SIGNED">SIGNED</option>
                    <option value="UNSIGNED">UNSIGNED</option>
                  </select>
                  <select
                    value={editingTag.endianness || "BIG_ENDIAN"}
                    onChange={(e) => setEditingTag({ ...editingTag, endianness: e.target.value as TagEndianness })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-slate-900 dark:text-white font-mono"
                  >
                    <option value="BIG_ENDIAN">Big-Endian</option>
                    <option value="LITTLE_ENDIAN">Little-Endian</option>
                    <option value="MID_BIG_ENDIAN">Mid-Big</option>
                    <option value="MID_LITTLE_ENDIAN">Mid-Little</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Rango Ingeniería (Mín .. Máx)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={editingTag.engMin ?? 0}
                    onChange={(e) => setEditingTag({ ...editingTag, engMin: parseFloat(e.target.value) || 0 })}
                    className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-slate-900 dark:text-white font-mono"
                  />
                  <span>..</span>
                  <input
                    type="number"
                    value={editingTag.engMax ?? 100}
                    onChange={(e) => setEditingTag({ ...editingTag, engMax: parseFloat(e.target.value) || 100 })}
                    className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Unidad de Ingeniería
                </label>
                <input
                  type="text"
                  value={editingTag.unit || ""}
                  onChange={(e) => setEditingTag({ ...editingTag, unit: e.target.value })}
                  placeholder="RPM, bar, °C, TCH, %, kW"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Modo de Acceso
                </label>
                <select
                  value={editingTag.writable ? "READ_WRITE" : "READ"}
                  onChange={(e) => {
                    const isRw = e.target.value === "READ_WRITE";
                    setEditingTag({ ...editingTag, writable: isRw, accessMode: isRw ? "READ_WRITE" : "READ" });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono"
                >
                  <option value="READ">Solo Lectura (READ) - Recomendado</option>
                  <option value="READ_WRITE">Lectura y Escritura (READ_WRITE)</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Modo de Adquisición
                </label>
                <select
                  value={editingTag.samplingMode || "SUBSCRIPTION"}
                  onChange={(e) => setEditingTag({ ...editingTag, samplingMode: e.target.value as TagSamplingMode })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white font-mono"
                >
                  <option value="SUBSCRIPTION">Suscripción por Evento (Recomendado)</option>
                  <option value="POLLING">Sondeo Cíclico (Polling)</option>
                  <option value="ON_CHANGE">Por Cambio Significativo (Deadband)</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Intervalo / Deadband / Timeout
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Scan ms</span>
                    <input
                      type="number"
                      value={editingTag.samplingIntervalMs || 1000}
                      onChange={(e) => setEditingTag({ ...editingTag, samplingIntervalMs: parseInt(e.target.value, 10) || 1000 })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Deadband</span>
                    <input
                      type="number"
                      value={editingTag.deadband ?? 0.1}
                      onChange={(e) => setEditingTag({ ...editingTag, deadband: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Stale ms</span>
                    <input
                      type="number"
                      value={editingTag.staleTimeoutMs || 5000}
                      onChange={(e) => setEditingTag({ ...editingTag, staleTimeoutMs: parseInt(e.target.value, 10) || 5000 })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Habilitaciones de Plataforma
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingTag.historianEnabled)}
                      onChange={(e) => setEditingTag({ ...editingTag, historianEnabled: e.target.checked })}
                      className="rounded text-emerald-600"
                    />
                    <span>Historiador</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingTag.dashboardEnabled)}
                      onChange={(e) => setEditingTag({ ...editingTag, dashboardEnabled: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>SCADA</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingTag.aiEnabled)}
                      onChange={(e) => setEditingTag({ ...editingTag, aiEnabled: e.target.checked })}
                      className="rounded text-purple-600"
                    />
                    <span>BioAI</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsEditorOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEditor}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow-sm"
              >
                Guardar Configuración de Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON / CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Importación Masiva de Tags Industriales
                </h3>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Pegue una lista en formato JSON de definiciones de tags industriales para el comisionamiento en bloque.
            </p>

            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder={`[
  {
    "canonicalName": "MOLINO_01.PRESION_HIDRAULICA",
    "sourceAddress": "ns=2;s=Milling.Hydraulic",
    "dataType": "FLOAT",
    "engMin": 0,
    "engMax": 250,
    "unit": "bar",
    "accessMode": "READ"
  }
]`}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleProcessImport}
                disabled={!importJsonText.trim()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-bold shadow-sm"
              >
                Importar Variables
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
