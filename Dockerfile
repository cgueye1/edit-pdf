# Build secure-pdf (app PDF) when the build context is the repo root.
# Usage: docker build -f Dockerfile.secure-pdf -t secure-pdf .
# Déploiement : https://secure.innovimpactdev.cloud/pdf — base href /pdf/
# Pour racine : --build-arg BASE_HREF=/

FROM node:22-alpine AS builder

ARG BASE_HREF=/pdf/
WORKDIR /app

COPY secure-pdf/package*.json ./

RUN npm ci --legacy-peer-deps

COPY secure-pdf/ ./

RUN npm run build --configuration=production-securelink -- --base-href ${BASE_HREF}

FROM nginx:alpine

COPY --from=builder /app/dist/pdf-editor-app/browser /usr/share/nginx/html

COPY secure-pdf/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
