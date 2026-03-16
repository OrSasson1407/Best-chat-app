# Use an official Node runtime as a parent image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# FIX: Change ownership of the /app directory to the 'node' user so winston can create the logs/ folder
RUN chown -R node:node /app

# Security: Run the container as the built-in non-root "node" user
USER node

# Expose the port your server runs on
EXPOSE 5000

# Start the server
CMD ["node", "index.js"]