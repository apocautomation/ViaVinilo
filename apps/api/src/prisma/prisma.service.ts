import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // D-039: el hash de la contraseña de la app nunca sale en una respuesta ni en la auditoría.
    // Solo el login lo pide explícitamente con `omit: { appPasswordHash: false }`.
    super({ omit: { customer: { appPasswordHash: true } } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
