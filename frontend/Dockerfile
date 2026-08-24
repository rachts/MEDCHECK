# ==============================================================================
# MEDCHECK Frontend Production Dockerfile
# Multi-stage Node builder + Nginx Alpine static distribution
# ==============================================================================

FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Nginx Alpine Runtime
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Included by every location block in nginx.conf -- the image will not start
# without it (nginx fails hard on a missing `include` target).
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf

# Fail the build, not the deploy, if either file is malformed.
RUN nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
