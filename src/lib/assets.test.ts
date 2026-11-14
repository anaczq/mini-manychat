import { describe, expect, it } from "vitest";
import { sniff } from "./assets";

const bytes = (...b: number[]) => new Uint8Array([...b, ...Array(12).fill(0)]);

describe("sniff (tipo pelo conteúdo, não pela extensão)", () => {
  it("reconhece PNG e JPEG", () => {
    expect(sniff(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d))).toBe("image/png");
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
  });

  it("recusa outros formatos, mesmo renomeados (.pdf, .pptx, .zip, .exe, .svg)", () => {
    expect(sniff(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBeNull(); // pdf
    expect(sniff(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull(); // zip/pptx
    expect(sniff(bytes(0x4d, 0x5a))).toBeNull(); // exe
    expect(sniff(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(sniff(new Uint8Array())).toBeNull();
  });
});
