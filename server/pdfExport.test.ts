import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";

describe("branded PDF report generation", () => {
  it("creates a non-empty PDF document with terminal report metadata", () => {
    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    pdf.setFillColor(6, 16, 23);
    pdf.rect(0, 0, 612, 90, "F");
    pdf.setTextColor(106, 229, 241);
    pdf.text("APEX MS", 42, 43);
    pdf.setTextColor(32, 48, 58);
    pdf.text("ECONOMIC STRESS TERMINAL / RISK REPORT", 42, 119);
    pdf.text("Session MKT-test • Tick 000123", 42, 144);

    const bytes = new Uint8Array(pdf.output("arraybuffer"));
    expect(bytes.length).toBeGreaterThan(1_000);
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toContain("%PDF");
  });
});
