import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ asWorker: vi.fn(), schema: {} }));

const { buildDm, dmFailureStatus, finalStatus } = await import("./processor");

const kw = { dmText: "Oi {{first_name}} !", dmLinkUrl: null, buttonLabel: null, assetId: null };

describe("buildDm", () => {
  it("troca {{first_name}} e tira o espaço antes da pontuação", () => {
    expect(buildDm({ commenterUsername: "ana" }, kw).text).toBe("Oi ana!");
    expect(buildDm({ commenterUsername: null }, kw).text).toBe("Oi!");
  });

  it("link sem botão vai no fim do texto; com botão vira buttonUrl", () => {
    expect(buildDm({ commenterUsername: "ana" }, { ...kw, dmLinkUrl: "https://x.com" })).toMatchObject({
      text: "Oi ana!\n\nhttps://x.com",
      buttonUrl: undefined,
    });
    expect(buildDm({ commenterUsername: "ana" }, { ...kw, dmLinkUrl: "https://x.com", buttonLabel: "Abrir" })).toMatchObject({
      text: "Oi ana!",
      buttonUrl: "https://x.com",
    });
  });

  it("arquivo sem link espera a resposta da pessoa", () => {
    expect(buildDm({ commenterUsername: "ana" }, { ...kw, assetId: "a1" }).awaitsReply).toBe(true);
    expect(buildDm({ commenterUsername: "ana" }, { ...kw, assetId: "a1", dmLinkUrl: "https://x.com" }).awaitsReply).toBe(false);
  });
});

describe("dmFailureStatus", () => {
  it("resposta privada gasta e resultado incerto nunca viram 'failed' (não podem ser reprocessados)", () => {
    expect(dmFailureStatus({ privateReplyConsumed: true, outcomeUnknown: false })).toBe("failed_consumed");
    expect(dmFailureStatus({ privateReplyConsumed: false, outcomeUnknown: true })).toBe("unknown");
    expect(dmFailureStatus({ privateReplyConsumed: false, outcomeUnknown: false })).toBe("failed");
  });
});

describe("finalStatus", () => {
  it("done só com DM e resposta ok; partial com um dos dois; failed com nenhum", () => {
    expect(finalStatus("sent", "sent")).toBe("done");
    expect(finalStatus("skipped", "skipped")).toBe("done");
    expect(finalStatus("sent", "failed")).toBe("partial");
    expect(finalStatus("failed_consumed", "sent")).toBe("partial");
    expect(finalStatus("unknown", "failed")).toBe("failed");
  });
});
