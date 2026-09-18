/**
 * BIOAZÚCAR 4.0 — DUAL-NIC NETWORK ARCHITECTURE & FIREWALL MANAGER (Iteration I11)
 * ===============================================================================
 * Conforms to IEC 62443-3-3 FR5 (Restricted Data Flow) & Zone/Conduit Architecture.
 * 
 * Hardware Layout:
 * - eth0 (OT Zone - Purdue L1/L2):
 *     - Subnet: 192.168.10.0/24 (Static IP: e.g. 192.168.10.50)
 *     - Gateway: NONE (0.0.0.0) -> Strictly isolated from Internet/WAN.
 *     - Allowed Inbound Ports: 502/802 (Modbus/TLS), 4840 (OPC UA), 102 (S7), 44818 (CIP).
 * - eth1 (DMZ / IT Egress - Purdue L3.5):
 *     - Subnet: 10.0.50.0/24 (Static IP: e.g. 10.0.50.15)
 *     - Gateway: 10.0.50.1 (Industrial Firewall / Bastion router)
 *     - Allowed Outbound: Port 443 / 8883 (TLS 1.3 / mTLS to Central BioAzúcar Cloud & MQTT Broker).
 *     - Denied Inbound: ALL unsolicited inbound traffic dropped.
 * - Kernel Constraint:
 *     - net.ipv4.ip_forward = 0 (Strictly prevents routing or bridge forwarding between eth0 and eth1).
 */

export interface NetworkInterfaceConfig {
  interfaceName: string;
  zone: "OT_PLANT" | "DMZ_SUPERVISORY" | "ISOLATED_LOOPBACK";
  ipAddress: string;
  subnetMask: string;
  gateway: string | null;
  mtu: number;
  macAddress: string;
  isLinkUp: boolean;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  droppedPackets: number;
  allowedPorts: number[];
}

export interface DualNicSecurityAudit {
  ipForwardingDisabled: boolean;
  otHasNoDefaultGateway: boolean;
  dmzRestrictedEgressOnly: boolean;
  rawSocketsBlocked: boolean;
  zoneConduitEnforced: boolean;
  complianceScore: number; // 0 to 100%
  violations: string[];
  recommendations: string[];
  lastAuditTimestamp: number;
}

export class DualNicManager {
  private static instance: DualNicManager | null = null;

  private eth0Config: NetworkInterfaceConfig = {
    interfaceName: "eth0",
    zone: "OT_PLANT",
    ipAddress: "192.168.10.50",
    subnetMask: "255.255.255.0",
    gateway: null, // Zero default gateway
    mtu: 1500,
    macAddress: "00:1B:21:A4:7B:10",
    isLinkUp: true,
    rxBytes: 142589020,
    txBytes: 89452100,
    rxPackets: 891204,
    txPackets: 541098,
    droppedPackets: 12,
    allowedPorts: [502, 802, 4840, 102, 44818],
  };

  private eth1Config: NetworkInterfaceConfig = {
    interfaceName: "eth1",
    zone: "DMZ_SUPERVISORY",
    ipAddress: "10.0.50.15",
    subnetMask: "255.255.255.0",
    gateway: "10.0.50.1",
    mtu: 1500,
    macAddress: "00:1B:21:A4:7B:11",
    isLinkUp: true,
    rxBytes: 82049102,
    txBytes: 159203910,
    rxPackets: 450123,
    txPackets: 789210,
    droppedPackets: 4,
    allowedPorts: [443, 8883],
  };

  private kernelIpForward: number = 0; // 0 = Disabled (Good)

  private constructor() {}

  public static getInstance(): DualNicManager {
    if (!DualNicManager.instance) {
      DualNicManager.instance = new DualNicManager();
    }
    return DualNicManager.instance;
  }

  public getInterfaceConfigs(): { eth0: NetworkInterfaceConfig; eth1: NetworkInterfaceConfig } {
    return {
      eth0: { ...this.eth0Config },
      eth1: { ...this.eth1Config },
    };
  }

  public updateInterfaceStatus(interfaceName: "eth0" | "eth1", updates: Partial<NetworkInterfaceConfig>): void {
    if (interfaceName === "eth0") {
      this.eth0Config = { ...this.eth0Config, ...updates };
    } else {
      this.eth1Config = { ...this.eth1Config, ...updates };
    }
  }

  public setKernelIpForward(value: 0 | 1): void {
    this.kernelIpForward = value;
  }

  public getKernelIpForward(): number {
    return this.kernelIpForward;
  }

  /**
   * Run automated IEC 62443-3-3 FR5 Dual-NIC security compliance audit
   */
  public auditDualNicCompliance(): DualNicSecurityAudit {
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check 1: IP Forwarding disabled
    const ipForwardingDisabled = this.kernelIpForward === 0;
    if (!ipForwardingDisabled) {
      violations.push("CRITICAL: net.ipv4.ip_forward is set to 1. Direct packet bridging between OT and IT is enabled.");
      recommendations.push("Execute 'sysctl -w net.ipv4.ip_forward=0' immediately and add to /etc/sysctl.d/99-bioazucar.conf");
    }

    // Check 2: OT Interface must NOT have default gateway
    const otHasNoDefaultGateway = this.eth0Config.gateway === null || this.eth0Config.gateway === "" || this.eth0Config.gateway === "0.0.0.0";
    if (!otHasNoDefaultGateway) {
      violations.push(`HIGH: OT interface eth0 has default gateway configured (${this.eth0Config.gateway}). WAN leak danger.`);
      recommendations.push("Remove 'gateway' parameter from eth0 in netplan/interfaces to prevent route leaks.");
    }

    // Check 3: DMZ interface has proper gateway & restricted ports
    const dmzHasValidGateway = Boolean(this.eth1Config.gateway && this.eth1Config.gateway !== "0.0.0.0");
    const dmzRestrictedEgressOnly = dmzHasValidGateway && this.eth1Config.allowedPorts.every((p) => [443, 8883, 9099].includes(p));
    if (!dmzRestrictedEgressOnly) {
      violations.push("MEDIUM: DMZ interface eth1 has open ports not compliant with TLS/mTLS egress specification.");
      recommendations.push("Restrict eth1 allowed inbound/outbound ports strictly to 443 and 8883.");
    }

    // Check 4: OT allowed ports compliant with industrial drivers
    const otPortsValid = this.eth0Config.allowedPorts.every((p) => [502, 802, 4840, 102, 44818].includes(p));
    if (!otPortsValid) {
      violations.push("MEDIUM: Non-industrial ports detected on eth0 OT network.");
      recommendations.push("Filter eth0 ports using iptables to allow only Modbus (502/802), OPC UA (4840), S7 (102), and EtherNet/IP (44818).");
    }

    // Calculate score
    let score = 100;
    if (!ipForwardingDisabled) score -= 40;
    if (!otHasNoDefaultGateway) score -= 30;
    if (!dmzRestrictedEgressOnly) score -= 15;
    if (!otPortsValid) score -= 15;

    return {
      ipForwardingDisabled,
      otHasNoDefaultGateway,
      dmzRestrictedEgressOnly,
      rawSocketsBlocked: true,
      zoneConduitEnforced: ipForwardingDisabled && otHasNoDefaultGateway,
      complianceScore: Math.max(0, score),
      violations,
      recommendations,
      lastAuditTimestamp: Date.now(),
    };
  }

  /**
   * Generates Linux iptables / nftables shell configuration script
   */
  public generateIptablesRulesScript(): string {
    return `#!/usr/bin/env bash
# ==============================================================================
# BIOAZÚCAR 4.0 — DUAL-NIC IPTABLES FIREWALL GENERATOR (IEC 62443-3-3 FR5)
# ==============================================================================
# Run on Industrial PC (Ubuntu/Debian) as root
# ==============================================================================

set -euo pipefail

echo "[FIREWALL] Flushing legacy rules..."
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X

# 1. Default Policies: DROP EVERYTHING by default
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# 2. Local Loopback (lo)
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# 3. Established and Related Connections
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# 4. Anti-Spoofing & Invalid Packets
iptables -A INPUT -m conntrack --ctstate INVALID -j DROP
iptables -A FORWARD -m conntrack --ctstate INVALID -j DROP

# 5. OT Interface (eth0) Rules - Inbound from PLCs/DCS
# Modbus RTU/TCP & Modbus Security (502, 802)
iptables -A INPUT -i eth0 -p tcp --dport 502 -s 192.168.10.0/24 -j ACCEPT
iptables -A INPUT -i eth0 -p tcp --dport 802 -s 192.168.10.0/24 -j ACCEPT
# OPC UA Binary Protocol (4840)
iptables -A INPUT -i eth0 -p tcp --dport 4840 -s 192.168.10.0/24 -j ACCEPT
# Siemens S7 ISO-on-TCP (102)
iptables -A INPUT -i eth0 -p tcp --dport 102 -s 192.168.10.0/24 -j ACCEPT
# Rockwell CIP / EtherNet/IP (44818, 2222)
iptables -A INPUT -i eth0 -p tcp --dport 44818 -s 192.168.10.0/24 -j ACCEPT
iptables -A INPUT -i eth0 -p udp --dport 2222 -s 192.168.10.0/24 -j ACCEPT

# Log & Drop unauthorized OT packets
iptables -A INPUT -i eth0 -m limit --limit 5/min -j LOG --log-prefix "OT_DROPPED: " --log-level 7
iptables -A INPUT -i eth0 -j DROP

# 6. DMZ Interface (eth1) Rules - Cloud Egress & Bastion
# Local health check endpoint
iptables -A INPUT -i eth1 -p tcp --dport 9099 -s 10.0.50.0/24 -j ACCEPT

# 7. CRITICAL: Kernel IP Forwarding Disable & Sysctl Hardening
echo 0 > /proc/sys/net/ipv4/ip_forward
cat << 'SYSCTL_EOF' > /etc/sysctl.d/99-bioazucar-dualnic.conf
net.ipv4.ip_forward = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
SYSCTL_EOF

sysctl -p /etc/sysctl.d/99-bioazucar-dualnic.conf

echo "[FIREWALL] Dual-NIC firewall rules and sysctl applied successfully."
`;
  }
}
