# Multi-stage build for Expo web app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy app source
COPY . .

# Set build-time environment variable (can be overridden)
ARG EXPO_PUBLIC_API_URL=http://localhost:3000
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

# Install Expo CLI if needed and build for web production
RUN npx expo install expo@latest
RUN npx expo export:web

# Production stage - serve static files
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/web-build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
