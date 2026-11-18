// Levanta el Postgres en memoria de los tests como servidor, para probar la API a mano.
// Uso: pnpm exec tsx test/serve-test-db.ts  (imprime el DATABASE_URL)
import { startTestDb } from "./test-db";

startTestDb().then(({ url }) => console.log(url));
