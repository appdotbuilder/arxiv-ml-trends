import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import { 
  reportGenerationInputSchema,
  ingestionRunResultSchema,
  reportResultSchema,
  latestReportResponseSchema,
  healthCheckSchema
} from './schema';

// Import handlers
import { ingestPapers } from './handlers/ingest_papers';
import { generateReport } from './handlers/generate_report';
import { getLatestReport } from './handlers/get_latest_report';
import { healthCheck } from './handlers/health_check';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check endpoint
  healthz: publicProcedure
    .output(healthCheckSchema)
    .query(() => healthCheck()),

  // Paper ingestion endpoint - triggers complete pipeline
  ingestRun: publicProcedure
    .output(ingestionRunResultSchema)
    .mutation(() => ingestPapers()),

  // Report generation endpoint - creates and optionally sends weekly report
  reportRun: publicProcedure
    .input(reportGenerationInputSchema)
    .output(reportResultSchema)
    .mutation(({ input }) => generateReport(input)),

  // Get latest report endpoint - retrieves most recent report for dashboard
  reportsLatest: publicProcedure
    .output(latestReportResponseSchema.nullable())
    .query(() => getLatestReport()),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`ArXiv ML Weekly Trend Alerter TRPC server listening at port: ${port}`);
}

start();