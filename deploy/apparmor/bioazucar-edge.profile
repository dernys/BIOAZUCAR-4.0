# ==============================================================================
# BIOAZÚCAR 4.0 — APPARMOR SECURITY PROFILE FOR EDGE DAEMON (IEC 62443 L3)
# ==============================================================================
# Target: /etc/apparmor.d/opt.bioazucar-edge.edge-daemon.cjs
# Profile Mode: enforce
# ==============================================================================

#include <tunables/global>

/opt/bioazucar-edge/edge-daemon.cjs {
  #include <abstractions/base>
  #include <abstractions/nameservice>
  #include <abstractions/node>

  # 1. Deny dangerous capabilities
  deny capability sys_admin,
  deny capability sys_rawio,
  deny capability sys_ptrace,
  deny capability sys_boot,
  deny capability mac_override,
  deny capability setuid,
  deny capability setgid,

  # 2. Allow network operations (OT TCP/UDP protocols and TLS outbound)
  network inet stream,
  network inet dgram,
  network inet6 stream,
  network inet6 dgram,

  # 3. Read-only application code
  /opt/bioazucar-edge/** r,
  /opt/bioazucar-edge/edge-daemon.cjs mr,
  /usr/bin/node rix,

  # 4. Strict Read-Only configuration
  /etc/bioazucar/edge.env r,
  /etc/bioazucar/certs/** r,

  # 5. Read-Write constrained data and log paths
  /var/lib/bioazucar-edge/** rwk,
  /var/log/bioazucar/** rwk,
  /opt/bioazucar-edge/data/** rwk,
  /tmp/** rwk,

  # 6. Deny access to sensitive host files
  deny /etc/shadow r,
  deny /etc/gshadow r,
  deny /root/** rwklx,
  deny /home/** rwklx,
}
