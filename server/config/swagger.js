const swaggerJsdoc = require("swagger-jsdoc");

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Best Chat App API",
      version: "1.0.0",
      description: "API documentation for the real-time chat application",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
      },
    ],
  },
  apis: ["./routes/*.js"], 
};

module.exports = swaggerJsdoc(swaggerOptions);