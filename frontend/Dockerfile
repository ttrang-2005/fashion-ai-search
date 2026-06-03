# Stage 1: Build the React Application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application files
COPY . .

# Define build arguments for environment variables
ARG VITE_API_URL=/api/v1
ARG VITE_IMAGE_BASE_URL=""

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_IMAGE_BASE_URL=$VITE_IMAGE_BASE_URL

# Build the project (creates the /app/dist directory)
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:stable-alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built files from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
