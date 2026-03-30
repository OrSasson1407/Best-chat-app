# Stage 1: Build the React application (Updated to Node 20)
FROM node:20-alpine AS builder
WORKDIR /app

# Copy only dependency files first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies (Switched to npm ci with legacy peer deps for React 19 compatibility)
RUN npm ci --legacy-peer-deps

# Copy the rest of the source code
COPY . .

# --- CRITICAL FIX 1: Declare ARGs so Docker lets Render variables inside ---
ARG VITE_API_URL
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
ARG VITE_FIREBASE_VAPID_KEY

# Build the app (Vite will now bake the above variables into the JS files)
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Serve the app with Nginx
FROM nginx:alpine

# Remove default nginx static assets before copying yours
RUN rm -rf /usr/share/nginx/html/*

# 🔧 FIX: Copy our custom Nginx configuration to handle React Router!
COPY nginx.conf /etc/nginx/conf.d/default.conf

# --- CRITICAL FIX 2: Vite outputs to 'dist', not 'build'! ---
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]