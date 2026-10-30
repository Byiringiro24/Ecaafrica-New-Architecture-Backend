export type DeviceIdentityCandidate = {
  id?: string | number;
  device_uid?: string;
  name?: string | null;
  tablet_ip?: string | null;
  location?: string | null;
  is_active?: boolean;
  tablet_id?: string | number | null;
};

export function normalizeDeviceAssignments(devices: DeviceIdentityCandidate[]) {
  return (devices || [])
    .filter((device) => device && (device.is_active === undefined || device.is_active !== false))
    .map((device) => ({
      id: device.id ?? device.device_uid ?? null,
      device_uid: device.device_uid ?? null,
      name: String(device.name || device.device_uid || 'Unnamed Device').trim(),
      tablet_ip: device.tablet_ip ?? null,
      location: device.location ?? null,
      is_active: device.is_active ?? true,
      tablet_id: device.tablet_id ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function findDeviceByLocalIp(devices: DeviceIdentityCandidate[], ipAddress?: string | null) {
  const normalizedIp = String(ipAddress || '').trim();
  if (!normalizedIp) return undefined;

  const directMatch = (devices || []).find((device) => {
    const candidateIp = String(device?.tablet_ip || '').trim();
    return candidateIp && candidateIp === normalizedIp;
  });

  if (directMatch) return directMatch;

  return (devices || []).find((device) => {
    const candidateIp = String(device?.tablet_ip || '').trim();
    return candidateIp && candidateIp.startsWith(normalizedIp.slice(0, -1));
  });
}
