const promClient = require('prom-client');
const promBundle = require('express-prom-bundle');

// Create a Registry which registers the metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metric to track active socket connections
const activeSocketsGauge = new promClient.Gauge({
  name: 'chat_active_sockets_total',
  help: 'Total number of active Socket.io connections',
});
register.registerMetric(activeSocketsGauge);

// Custom metric to track message delivery latency
const messageLatencyHistogram = new promClient.Histogram({
  name: 'chat_message_delivery_latency_ms',
  help: 'Latency of message delivery from server to client in ms',
  buckets: [10, 50, 100, 250, 500, 1000] // Define buckets in milliseconds
});
register.registerMetric(messageLatencyHistogram);

// Middleware for Express to track HTTP route metrics automatically
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  promClient: { collectDefaultMetrics: false }, // We already collect defaults
  promRegistry: register
});

module.exports = { 
  register, 
  metricsMiddleware, 
  activeSocketsGauge, 
  messageLatencyHistogram 
};