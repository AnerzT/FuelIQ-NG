import express from "express";
import { registerRoutes } from "./routes.js"; 
import { serveStatic } from "./static.js"; 
import { createServer } from "http";
import {
  setupCompression,
  setupCors,
  setupHelmet,
  setupApiRateLimit,
  securityHeaders,
  apiErrorHandler,
  notFoundHandler,
} from "./middleware/production.js"; 

const app = express();
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === "production";

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(securityHeaders);

if (isProduction) {
  setupCompression(app);
  setupCors(app);
  setupHelmet(app);
  app.use(setupApiRateLimit);
}

registerRoutes(app);
serveStatic(app);

app.use(notFoundHandler);
app.use(apiErrorHandler);

export default app; 

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
