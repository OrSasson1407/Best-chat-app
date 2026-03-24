# Stage 1: Build the React application (Updated to Node 20)
FROM node:20-alpine AS builder
WORKDIR /app

# Copy only dependency files first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies (Switched to npm ci with legacy peer deps for React 19 compatibility)
RUN npm ci --legacy-peer-deps

# Copy the rest of the source code
COPY . .

# Build the app
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Serve the app with Nginx
FROM nginx:alpine

# Remove default nginx static assets before copying yours
RUN rm -rf /usr/share/nginx/html/*

# 🔧 FIX: Copy our custom Nginx configuration to handle React Router!
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the build output to replace the default nginx contents
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]