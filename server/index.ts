import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes.js";
import { testDatabaseConnection } from "./db.js"; // Assuming you have this

// ============================================
// GLOBAL ERROR HANDLERS (catch everything)
// ============================================

// Catch uncaught exceptions (synchronous errors)
process.on('uncaughtException', (err: Error) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  
  // In development, you might want to exit, but in production serverless,
  // we log and let the instance die gracefully
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

// Catch unhandled promise rejections (asynchronous errors)
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('⚠️ UNHANDLED REJECTION:', {
    reason: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
      stack: reason.stack
    } : reason,
    timestamp: new Date().toISOString()
  });
});

// Handle SIGTERM gracefully (Vercel sends this)
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM received, cleaning up...');
  // Close any open connections here
  process.exit(0);
});

// ============================================
// CREATE EXPRESS APP
// ============================================

export async function createApp(): Promise<Express> {
  const app = express();

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint (always works, even before DB)
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Detailed health check with DB status
  app.get('/api/health/detailed', async (req: Request, res: Response) => {
    try {
      const dbStatus = await testDatabaseConnection?.() || 'unknown';
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbStatus,
        environment: process.env.NODE_ENV
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  try {
    // Test database connection before starting
    if (testDatabaseConnection) {
      await testDatabaseConnection();
      console.log('✅ Database connected successfully');
    }

    // Create HTTP server and register routes
    const httpServer = createServer(app);
    await registerRoutes(httpServer, app);
    console.log('✅ Routes registered successfully');

  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    // Don't throw - let the app start with minimal functionality
    // The error endpoint below will handle requests
  }

  // ============================================
  // ERROR HANDLING MIDDLEWARE
  // ============================================

  // 404 handler for undefined routes
  app.use((req: Request, res: Response) => {
    res.status(404).json({ 
      success: false, 
      message: `Route not found: ${req.method} ${req.path}` 
    });
  });

  // Global error handling middleware (must be last)
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Express Error:', {
      path: req.path,
      method: req.method,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      },
      timestamp: new Date().toISOString()
    });

    // Don't expose internal error details in production
    const isProd = process.env.NODE_ENV === 'production';
    
    res.status(err.status || 500).json({
      success: false,
      message: isProd ? 'Internal server error' : err.message,
      ...(isProd ? {} : { stack: err.stack })
    });
  });

  return app;
}

// For Vercel serverless
let initializedApp: Express | null = null;

const app = express();

app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (!initializedApp) {
    try {
      initializedApp = await createApp();
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to initialize' });
      return;
    }
  }
  initializedApp(req, res, next);
});

export default app;

// For local development
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  createApp().then(initializedApp => {
    const httpServer = createServer(initializedApp);
    httpServer.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  }).catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
}
