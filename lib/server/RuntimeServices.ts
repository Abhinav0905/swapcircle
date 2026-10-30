import { env } from "cloudflare:workers";
import { AppError } from "../domain/errors";
import type { TasteProvider } from "../domain/types";
import { FixtureTasteProvider } from "../demo/FixtureTasteProvider";
import { QlooClient } from "../qloo/QlooClient";
import { CapabilityService } from "../storage/CapabilityService";
import { RoomRepository } from "../storage/RoomRepository";
import { RoomService } from "../storage/RoomService";
import { ApiHandlers } from "./ApiHandlers";
import { RequestLimiter } from "./HttpBoundary";
import { McpServer } from "./McpServer";
import { readRuntimeConfiguration } from "./RuntimeConfiguration";

/** A missing key blocks provider calls without blocking review of stored evidence. */
class UnavailableTasteProvider implements TasteProvider {
  readonly source = "qloo" as const;
  private unavailable(): never { throw new AppError("Live Qloo access is not configured yet.", 503, "qloo_not_configured"); }
  async search(): Promise<never> { return this.unavailable(); }
  async rank(): Promise<never> { return this.unavailable(); }
}

function services() {
  const configuration = readRuntimeConfiguration(
    env as unknown as Record<string, unknown>,
    typeof process === "undefined" ? {} : process.env,
  );
  const repository = new RoomRepository();
  const limiter = new RequestLimiter(repository);
  let liveProvider: TasteProvider | undefined;
  const getLiveProvider = () => {
    liveProvider ??= configuration.qlooConfigured
      ? new QlooClient({ apiKey: configuration.apiKey, baseUrl: configuration.baseUrl })
      : new UnavailableTasteProvider();
    return liveProvider;
  };
  const rooms = new RoomService(repository, new CapabilityService(),
    (mode) => mode === "demo" ? new FixtureTasteProvider() : getLiveProvider());
  return { rooms, limiter, configuration, getLiveProvider };
}

export function getApiHandlers(): ApiHandlers {
  const { rooms, limiter, configuration, getLiveProvider } = services();
  return new ApiHandlers({
    rooms, limiter, qlooConfigured: configuration.qlooConfigured,
    search: (query, type) => getLiveProvider().search(query, type),
  });
}

export function getMcpServer(): McpServer {
  const { rooms, limiter } = services();
  return new McpServer(rooms, limiter);
}
