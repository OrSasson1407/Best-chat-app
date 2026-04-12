# Stage 1: Build & Setup (Node 20)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# CRITICAL FIX: Only install production dependencies to reduce image size and vulnerabilities
RUN npm ci --omit=dev

# Copy the rest of the backend source code
COPY . .

# Expose the backend port
EXPOSE 5000

# Start the Node server (Do NOT use nodemon in production)
CMD ["npm", "start"]