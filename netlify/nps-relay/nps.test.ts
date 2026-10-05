import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getStore, handleRelayRequest } = vi.hoisted(() => ({
  getStore: vi.fn(),
  handleRelayRequest: vi.fn(),
}));

vi.mock("@netlify/blobs", () => ({ getStore }));

vi.mock("./relay", async importOriginal => {
  const actual = await importOriginal<typeof import("./relay")>();
  return { ...actual, handleRelayRequest };
});

import handler, { config } from "../functions/nps.mjs";
import {
  ACK_PATH,
  HUB_SECRET_HASH_ENV,
  PENDING_PATH,
  REGISTER_PATH,
  RELAY_BASE_PATH,
  STORE_NAME,
  type RelayDeps,
} from "./relay";

const ORIGIN = "https://relay.test";
const CONTEXT_IP = "203.0.113.7";
const HEADER_IP = "198.51.100.9";
const HUB_HASH = "a".repeat(64);

const fakeStore = { tag: "fake-store" };
const relayResponse = new Response("relayed", { status: 202 });

function lastDeps(): RelayDeps {
  const call = handleRelayRequest.mock.calls.at(-1);
  if (!call) throw new Error("handleRelayRequest was not called");
  return call[1] as RelayDeps;
}

describe("netlify/functions/nps.mts", () => {
  const savedHubHash = process.env[HUB_SECRET_HASH_ENV];

  beforeEach(() => {
    getStore.mockReset().mockReturnValue(fakeStore);
    handleRelayRequest.mockReset().mockResolvedValue(relayResponse);
    delete process.env[HUB_SECRET_HASH_ENV];
  });

  afterEach(() => {
    if (savedHubHash === undefined) delete process.env[HUB_SECRET_HASH_ENV];
    else process.env[HUB_SECRET_HASH_ENV] = savedHubHash;
  });

  it("declares exactly the four relay routes, and no public read path", () => {
    expect(config.path).toEqual([
      RELAY_BASE_PATH,
      REGISTER_PATH,
      PENDING_PATH,
      ACK_PATH,
    ]);
    expect(new Set(config.path).size).toBe(config.path.length);
  });

  it("opens the relay blob store with strong consistency and hands it to the relay", async () => {
    const req = new Request(ORIGIN + RELAY_BASE_PATH, { method: "POST" });
    const res = await handler(req, { ip: CONTEXT_IP });

    expect(res).toBe(relayResponse);
    expect(getStore).toHaveBeenCalledTimes(1);
    expect(getStore).toHaveBeenCalledWith({
      name: STORE_NAME,
      consistency: "strong",
    });
    expect(handleRelayRequest).toHaveBeenCalledTimes(1);
    expect(handleRelayRequest.mock.calls[0][0]).toBe(req);
    expect(lastDeps().store).toBe(fakeStore);
  });

  it("opens a fresh store per invocation rather than caching one across requests", async () => {
    await handler(new Request(ORIGIN + RELAY_BASE_PATH, { method: "POST" }), {
      ip: CONTEXT_IP,
    });
    await handler(new Request(ORIGIN + REGISTER_PATH, { method: "POST" }), {
      ip: CONTEXT_IP,
    });
    expect(getStore).toHaveBeenCalledTimes(2);
  });

  it(`reads the hub secret hash only from ${HUB_SECRET_HASH_ENV}`, async () => {
    await handler(new Request(ORIGIN + PENDING_PATH), { ip: CONTEXT_IP });
    expect(lastDeps().env).toEqual({ hubSecretHash: undefined });

    process.env[HUB_SECRET_HASH_ENV] = HUB_HASH;
    await handler(new Request(ORIGIN + PENDING_PATH), { ip: CONTEXT_IP });
    expect(lastDeps().env).toEqual({ hubSecretHash: HUB_HASH });
  });

  it("never passes a now() override, so the relay uses the real clock in production", async () => {
    await handler(new Request(ORIGIN + RELAY_BASE_PATH, { method: "POST" }), {
      ip: CONTEXT_IP,
    });
    expect(lastDeps().now).toBeUndefined();
  });

  describe("client IP used for rate limiting", () => {
    it("prefers the platform-reported context.ip over any header", async () => {
      const req = new Request(ORIGIN + RELAY_BASE_PATH, {
        method: "POST",
        headers: { "x-nf-client-connection-ip": HEADER_IP },
      });
      await handler(req, { ip: CONTEXT_IP });
      expect(lastDeps().clientIp).toBe(CONTEXT_IP);
    });

    it("falls back to x-nf-client-connection-ip when the context has no ip", async () => {
      const req = new Request(ORIGIN + RELAY_BASE_PATH, {
        method: "POST",
        headers: { "x-nf-client-connection-ip": HEADER_IP },
      });
      await handler(req, {});
      expect(lastDeps().clientIp).toBe(HEADER_IP);

      await handler(req, { ip: "" });
      expect(lastDeps().clientIp).toBe(HEADER_IP);
    });

    it("passes undefined (not null or empty) when no IP source is available", async () => {
      await handler(
        new Request(ORIGIN + RELAY_BASE_PATH, { method: "POST" }),
        {}
      );
      expect(lastDeps().clientIp).toBeUndefined();

      await handler(new Request(ORIGIN + RELAY_BASE_PATH, { method: "POST" }), {
        ip: "",
      });
      expect(lastDeps().clientIp).toBeUndefined();
    });

    it("ignores other forwarding headers that a client could set", async () => {
      const req = new Request(ORIGIN + RELAY_BASE_PATH, {
        method: "POST",
        headers: { "x-forwarded-for": HEADER_IP, "x-real-ip": HEADER_IP },
      });
      await handler(req, {});
      expect(lastDeps().clientIp).toBeUndefined();
    });
  });
});
