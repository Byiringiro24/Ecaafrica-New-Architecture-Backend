import { findDeviceByLocalIp, normalizeDeviceAssignments } from "../src/utils/device-identity";

describe("tablet device identity mapping", () => {
  it("prefers the exact local IP match for the active device", () => {
    const devices = [
      { id: "dev-2", name: "Back Gate", tablet_ip: "192.168.1.77", is_active: true },
      { id: "dev-1", name: "Main Gate", tablet_ip: "192.168.1.76", is_active: true },
      { id: "dev-3", name: "Office Gate", tablet_ip: "192.168.1.78", is_active: false },
    ];

    expect(findDeviceByLocalIp(devices, "192.168.1.76")?.name).toBe("Main Gate");
    expect(findDeviceByLocalIp(devices, "192.168.1.99")?.name).toBeUndefined();
  });

  it("sorts available names consistently for the tablet UI", () => {
    const devices = [
      { id: "dev-2", name: "Zoo Gate", tablet_ip: "192.168.1.77", is_active: true },
      { id: "dev-1", name: "Main Gate", tablet_ip: "192.168.1.76", is_active: true },
    ];

    const names = normalizeDeviceAssignments(devices).map((device) => device.name);
    expect(names).toEqual(["Main Gate", "Zoo Gate"]);
  });
});
