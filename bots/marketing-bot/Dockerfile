FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source and config
COPY tsconfig.json ./
COPY src/ ./src/
COPY knowledge/ ./knowledge/

# Build the project
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install production-only dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled code and knowledge base from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/knowledge ./knowledge

EXPOSE 8080

CMD ["node", "dist/index.js"]
