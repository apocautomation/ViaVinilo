import { Controller, Get, HttpCode, MessageEvent, Param, Patch, Post, Sse } from "@nestjs/common";
import { sectorCodeSchema, transitionSchema } from "@viavinilo/contracts";
import { Observable, distinctUntilChanged, from, interval, map, merge, startWith, switchMap } from "rxjs";
import { z } from "zod";
import { CurrentUser, type AuthUser } from "../auth/decorators";
import { ZodBody, ZodQuery } from "../common/zod";
import { JobsService, type BoardQuery, type TransitionBody } from "./jobs.service";

const boardQuerySchema = z.object({
  sector: sectorCodeSchema,
  machineId: z.string().min(1).optional(),
  materialId: z.string().min(1).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupByMaterial: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

const streamQuerySchema = z.object({ sector: sectorCodeSchema });
const machineSchema = z.object({ machineId: z.string().min(1).nullable() });

/** Cada cuánto se revisa si cambió el tablero. Cubre también las órdenes que crea el worker de mails. */
const POLL_MS = Number(process.env.BOARD_POLL_MS ?? 2000);

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get("board")
  board(@ZodQuery(boardQuerySchema) query: BoardQuery, @CurrentUser() user: AuthUser) {
    return this.jobs.board(user, query);
  }

  /**
   * Tiempo real (SSE): manda "changed" cuando entra o se mueve una orden del sector, y el tablero
   * se vuelve a pedir. Se usa con fetch y el token en el header (no con EventSource).
   */
  @Sse("board/stream")
  stream(@ZodQuery(streamQuerySchema) query: { sector: z.infer<typeof sectorCodeSchema> }, @CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return from(this.jobs.sectorIdForStream(user, query.sector)).pipe(
      switchMap((sectorId) =>
        merge(
          interval(POLL_MS).pipe(
            startWith(0),
            switchMap(() => from(this.jobs.version(sectorId))),
            distinctUntilChanged(),
            map((version) => ({ type: "changed", data: { version } }) as MessageEvent),
          ),
          // Mantiene viva la conexión a través de proxies.
          interval(25_000).pipe(map(() => ({ type: "ping", data: {} }) as MessageEvent)),
        ),
      ),
    );
  }

  @Get(":id")
  detail(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.jobs.detail(user, id);
  }

  @Post(":id/transition")
  @HttpCode(200)
  transition(@Param("id") id: string, @ZodBody(transitionSchema) body: TransitionBody, @CurrentUser() user: AuthUser) {
    return this.jobs.transition(user, id, body);
  }

  @Patch(":id/machine")
  assignMachine(@Param("id") id: string, @ZodBody(machineSchema) body: { machineId: string | null }, @CurrentUser() user: AuthUser) {
    return this.jobs.assignMachine(user, id, body.machineId);
  }
}
