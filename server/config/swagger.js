const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path"); // ADDED: Required for absolute path resolution

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Best Chat App API",
      version: "1.0.0",
      description: "API documentation for the real-time chat application",
    },
    // 1. IMPROVEMENT: Dynamic Server URLs
    // Allows you to easily switch between local development and production environments in the Swagger UI.
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: "Local Development Server",
      },
      {
        url: process.env.PRODUCTION_URL || "https://api.yourproductiondomain.com",
        description: "Production Server",
      },
    ],
    // 2. IMPROVEMENT: Global Security Definitions
    // Adds an "Authorize" button to your Swagger UI so you can test protected routes using JWT tokens.
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token to authenticate API requests.",
        },
      },
    },
    // Applies the security scheme globally to all routes by default
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  // 3. IMPROVEMENT: Absolute Paths for Routing
  // Safely resolves the path to your routes folder regardless of where the Node process is started from.
  apis: [path.join(__dirname, "../routes/*.js")], 
};

module.exports = swaggerJsdoc(swaggerOptions);