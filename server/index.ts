import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes.js";
import { testDatabaseConnection } from "./db.js";

// ============================================
// GLOBAL ERROR HANDLERS
// ============================================
process.on('uncaughtException', (err: Error) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('⚠️ UNHANDLED REJECTION:', reason);
});

process.on('SIGTERM', () => {
  console.log('📡 SIGTERM received');
  process.exit(0);
});

// ============================================
// CREATE EXPRESS APP
// ============================================
export async function createApp(): Promise<Express> {
  console.log('📦 Creating Express app...');
  const app = express();

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`📨 ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Detailed health check
  app.get('/api/health/detailed', async (req: Request, res: Response) => {
    try {
      const dbStatus = await testDatabaseConnection?.() || 'unknown';
      res.json({
        status: 'ok',
        database: dbStatus,
        environment: process.env.NODE_ENV
      });
    } catch (error) {
      res.status(500).json({ status: 'error', database: 'disconnected' });
    }
  });

  try {
    // Test database connection
    if (testDatabaseConnection) {
      await testDatabaseConnection();
      console.log('✅ Database connected');
    }

    // Create HTTP server and register routes
    console.log('🔄 Creating HTTP server...');
    const httpServer = createServer(app);
    
    console.log('🔄 Registering routes...');
    await registerRoutes(httpServer, app);
    console.log('✅ Routes registered successfully');

    // List all registered routes (for debugging)
    console.log('📋 Registered routes:');
    app._router?.stack?.forEach((layer: any) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
        console.log(`   ${methods} ${layer.route.path}`);
      }
    });

  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
  }

  // 404 handler
  app.use((req: Request, res: Response) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ 
      success: false, 
      message: `Route not found: ${req.method} ${req.path}` 
    });
  });

  // Error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Express Error:', err);
    res.status(err.status || 500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
  });

  return app;
}

// ============================================
// For Vercel serverless
// ============================================
let cachedApp: Express | null = null;

async function getApp(): Promise<Express> {
  if (!cachedApp) {
    console.log('🚀 Initializing app for Vercel...');
    cachedApp = await createApp();
    console.log('✅ App initialized for Vercel');
  }
  return cachedApp;
}

// Vercel serverless handler
export default async function handler(req: Request, res: Response) {
  console.log(`🎯 Vercel handler received: ${req.method} ${req.url}`);
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error('❌ Handler error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
}

// ============================================
// For local development
// ============================================
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  createApp().then(app => {
    const httpServer = createServer(app);
    httpServer.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🔗 Test register: http://localhost:${PORT}/api/auth/register`);
    });
  }).catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
}
