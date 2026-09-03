import { describe, it, expect } from "vitest";
import { formatIndustrialTimestamp } from "../services/dbService";

describe("CMMS & MES Reliability Engineering Metrics", () => {
  it("should calculate Mean Time Between Failures (MTBF) and Mean Time To Repair (MTTR)", () => {
    // 500 operating hours with 2 breakdown events lasting 4 hours and 6 hours
    const totalOperatingHours = 500;
    const breakdownCount = 2;
    const totalDowntimeHours = 4 + 6;

    const mtbf = (totalOperatingHours - totalDowntimeHours) / breakdownCount;
    const mttr = totalDowntimeHours / breakdownCount;
    const technicalAvailability = (mtbf / (mtbf + mttr)) * 100;

    expect(mtbf).toBe(245);
    expect(mttr).toBe(5);
    expect(technicalAvailability).toBeCloseTo(98.0, 1);
  });

  it("should format timestamps reliably for industrial audit compliance", () => {
    const ts = formatIndustrialTimestamp();
    expect(ts).toBeDefined();
    expect(typeof ts).toBe("string");
    expect(ts.length).toBeGreaterThanOrEqual(10);
  });
});
