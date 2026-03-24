# Use an official Node runtime as a parent image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy package files and change ownership in one step to leverage layer caching
COPY --chown=node:node package*.json ./

# Install dependencies using 'ci' for faster, deterministic builds
RUN npm ci --omit=dev

# Copy the rest of the application code and change ownership
# This prevents Docker from doubling the size of your image layer!
COPY --chown=node:node . .

# Security: Run the container as the built-in non-root "node" user
USER node

# Expose the port your server runs on
EXPOSE 5000

# Start the server
CMD ["node", "index.js"]