import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, errorMessage } from "./index";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("errorMessage", () => {
  it("prefiere el primer error de campo", () => {
    expect(
      errorMessage({ message: "Datos inválidos", errors: { email: "El email no es válido" } }, "x"),
    ).toBe("El email no es válido");
  });
  it("toma el primer mensaje de una lista", () => {
    expect(errorMessage({ message: ["Falta el nombre", "Falta el email"] }, "x")).toBe("Falta el nombre");
  });
  it("usa el texto de respaldo si la respuesta no trae mensaje", () => {
    expect(errorMessage({}, "Algo salió mal")).toBe("Algo salió mal");
  });
});

describe("createApiClient", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("guarda el token con su clave y lo manda en cada pedido", async () => {
    const client = createApiClient({ baseUrl: "http://api", tokenKey: "vv.token" });
    client.saveToken("abc");
    fetchMock.mockResolvedValue(json(200, { ok: true }));

    await expect(client.api("/me")).resolves.toEqual({ ok: true });

    expect(window.localStorage.getItem("vv.token")).toBe("abc");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api/me");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer abc");
  });

  it("sin token no manda Authorization", async () => {
    const client = createApiClient({ baseUrl: "http://api", tokenKey: "vv.token" });
    fetchMock.mockResolvedValue(json(200, {}));
    await client.api("/x");
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).has("Authorization")).toBe(false);
  });

  it("una respuesta 204 devuelve undefined", async () => {
    const client = createApiClient({ baseUrl: "http://api", tokenKey: "k" });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(client.api("/x", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("un error de la API llega como ApiError con su estado y sus errores de campo", async () => {
    const client = createApiClient({ baseUrl: "http://api", tokenKey: "k" });
    fetchMock.mockResolvedValue(json(400, { errors: { cuit: "CUIT inválido" } }));
    const err = await client.api("/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ message: "CUIT inválido", status: 400, errors: { cuit: "CUIT inválido" } });
  });

  it("sin conexión avisa en castellano con estado 0", async () => {
    const client = createApiClient({ baseUrl: "http://api", tokenKey: "k" });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(client.api("/x")).rejects.toMatchObject({
      status: 0,
      message: "No hay conexión. Revisá internet y probá de nuevo.",
    });
  });

  it("un 401 llama a on401 antes de fallar", async () => {
    const on401 = vi.fn();
    const client = createApiClient({ baseUrl: "http://api", tokenKey: "k", on401 });
    fetchMock.mockResolvedValue(json(401, { message: "Sesión vencida" }));
    await expect(client.api("/x")).rejects.toMatchObject({ status: 401, message: "Sesión vencida" });
    expect(on401).toHaveBeenCalledOnce();
  });

  it("clearToken borra la sesión guardada", () => {
    const client = createApiClient({ baseUrl: "http://api", tokenKey: "k" });
    client.saveToken("abc");
    client.clearToken();
    expect(client.getToken()).toBeNull();
  });
});
