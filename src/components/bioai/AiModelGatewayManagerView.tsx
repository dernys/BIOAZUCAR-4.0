import React from "react";
import { UserRole, TenantEnterprise } from "../../types";
import { BioAiControlCenterView } from "./BioAiControlCenterView";

interface AiModelGatewayManagerViewProps {
  currentRole: UserRole;
  activeTenant?: TenantEnterprise;
  theme?: "dark" | "light";
}

export const AiModelGatewayManagerView: React.FC<AiModelGatewayManagerViewProps> = ({
  currentRole,
  activeTenant,
  theme = "dark",
}) => {
  return (
    <BioAiControlCenterView
      currentRole={currentRole}
      activeTenant={activeTenant}
      theme={theme}
    />
  );
};
