/**
 * db-push-ws.ts
 * Alternativa a `prisma db push` para cuando el ISP bloquea el puerto 5432.
 * 1. Genera el SQL del schema con `prisma migrate diff --from-empty`
 * 2. Aplica cada statement vía WebSockets (puerto 443), omitiendo los que ya existen
 * 3. Corre ALTER TABLE IF NOT EXISTS para columnas nuevas en tablas existentes
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const ALREADY_EXISTS_CODES = new Set(['42P07', '42710', '42701', '42P16']);

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((stmt) => stmt.length > 0);
}

// Columnas nuevas que se agregan a tablas existentes (idempotente con IF NOT EXISTS)
const ALTER_STATEMENTS = [
  'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monthlyBudget" DECIMAL(10,2)',
  `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "type" VARCHAR(10) NOT NULL DEFAULT 'gasto'`,
  `ALTER TABLE "users" ALTER COLUMN "isActive" SET DEFAULT false`,
];

async function main(): Promise<void> {
  console.log('📐 Generando SQL desde prisma/schema.prisma...');
  let migrationSql: string;

  try {
    migrationSql = execSync(
      'npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script',
      { encoding: 'utf-8' },
    );
  } catch (err) {
    console.error('❌ Error generando SQL:', err);
    process.exit(1);
  }

  const statements = splitStatements(migrationSql);
  console.log(`\n🔌 Conectando a Neon vía WebSockets...`);

  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const client = await pool.connect();

  try {
    // Paso 1: Crear tablas nuevas (omite las que ya existen)
    if (statements.length > 0) {
      console.log(`\n⚙️  Aplicando ${statements.length} statements del schema:\n`);
      for (const stmt of statements) {
        const preview = stmt.replace(/\n/g, ' ').substring(0, 70);
        try {
          await client.query(stmt);
          console.log(`  ✅ ${preview}`);
        } catch (err: unknown) {
          const pgErr = err as { code?: string };
          if (pgErr.code && ALREADY_EXISTS_CODES.has(pgErr.code)) {
            console.log(`  ⚠️  Ya existe, omitido: ${preview}`);
          } else {
            console.error(`  ❌ Error: ${preview}`);
            throw err;
          }
        }
      }
    }

    // Paso 2: Agregar columnas nuevas a tablas existentes (idempotente)
    console.log(`\n🔧 Aplicando migraciones de columnas nuevas:\n`);
    for (const stmt of ALTER_STATEMENTS) {
      try {
        await client.query(stmt);
        console.log(`  ✅ ${stmt}`);
      } catch (err: unknown) {
        const pgErr = err as { code?: string; message?: string };
        console.log(`  ⚠️  ${pgErr.message ?? stmt}`);
      }
    }

    console.log('\n✅ Schema sincronizado correctamente en Neon.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
