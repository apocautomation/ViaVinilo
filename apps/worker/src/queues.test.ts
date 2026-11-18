import { describe, expect, it } from "vitest";
import { QUEUES, isValidQueueName } from "./queues";

describe("colas", () => {
  it("todos los nombres son válidos para BullMQ y únicos", () => {
    const names = Object.values(QUEUES);
    expect(names.every(isValidQueueName)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });
});
