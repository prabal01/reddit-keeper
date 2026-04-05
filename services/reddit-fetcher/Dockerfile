# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and install all dependencies (including devDeps for tsc)
COPY package*.json ./
RUN npm install

# Copy source code and config
COPY . .

# Build the TypeScript project
RUN npm run build

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled code from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3002

CMD ["node", "dist/server.js"]
