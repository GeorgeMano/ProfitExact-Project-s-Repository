import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserClient } = vi.hoisted(() => ({
  createBrowserClient: vi.fn(() => ({ auth: {} })),
}));

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));

beforeEach(() => {
  vi.resetModules();
  createBrowserClient.mockClear();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_DEMO_AUTH", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("conexiunea Supabase", () => {
  it("folosește Publishable și reutilizează clientul fără conexiuni în test", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy-anon-example");
    const client = await import("./client");

    expect(client.hasSupabaseConfig()).toBe(true);
    expect(client.getSupabaseBrowserClient()).toBe(client.getSupabaseBrowserClient());
    expect(createBrowserClient).toHaveBeenCalledExactlyOnceWith(
      "https://example.supabase.co",
      "sb_publishable_example",
    );
  });

  it("acceptă în continuare configurația cu anon", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy-anon-example");
    const client = await import("./client");
    expect(client.hasSupabaseConfig()).toBe(true);
    client.getSupabaseBrowserClient();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "legacy-anon-example",
    );
  });

  it.each([
    ["NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy-anon-example"],
  ])("nu creează clientul dacă există numai %s", async (name, value) => {
    vi.stubEnv(name, value);
    const client = await import("./client");
    expect(client.hasSupabaseConfig()).toBe(false);
    expect(client.getSupabaseBrowserClient()).toBeNull();
    expect(createBrowserClient).not.toHaveBeenCalled();
  });
});

describe("modul de depanare local", () => {
  it("folosește codul fix 123456", async () => {
    const client = await import("./client");
    expect(client.DEMO_VERIFICATION_CODE).toBe("123456");
  });

  it("este activ implicit în dev, fără configurare Supabase", async () => {
    const client = await import("./client");
    expect(client.canUseSupabaseDemo()).toBe(true);
  });

  it("rămâne activ implicit în dev chiar dacă Supabase este configurat", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    const client = await import("./client");
    expect(client.hasSupabaseConfig()).toBe(true);
    expect(client.canUseSupabaseDemo()).toBe(true);
  });

  it("se dezactivează local cu NEXT_PUBLIC_DEMO_AUTH=off", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_AUTH", "off");
    const client = await import("./client");
    expect(client.canUseSupabaseDemo()).toBe(false);
  });

  it("nu este niciodată activ în producție", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const client = await import("./client");
    expect(client.canUseSupabaseDemo()).toBe(false);
    expect(client.getSupabaseBrowserClient()).toBeNull();
  });

  it("nu este activ în producție nici dacă Supabase este configurat", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    const client = await import("./client");
    expect(client.canUseSupabaseDemo()).toBe(false);
  });
});
