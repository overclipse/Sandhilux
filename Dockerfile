# ── Stage 1: Build frontend ────────────────────────────────────────────────────
FROM node:22-alpine AS frontend

WORKDIR /app

COPY web/package.json web/package-lock.json ./
RUN npm ci --silent

COPY web/ ./
RUN NODE_OPTIONS="--max-old-space-size=384" npm run build

# ── Stage 2: Build Go backend ──────────────────────────────────────────────────
FROM golang:1.26.1-alpine AS backend

ENV GOTOOLCHAIN=auto
ENV GOFLAGS="-p=1"
ENV GOGC=50
ENV GOMEMLIMIT=512MiB

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN VERSION=$(cat VERSION 2>/dev/null | tr -d '[:space:]' || echo "dev") && \
    COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "") && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath \
      -ldflags="-s -w -X overclipse/Sandhilux/internal/handler.BuildVersion=${VERSION} -X overclipse/Sandhilux/internal/handler.BuildCommit=${COMMIT}" \
      -o /sandhilux ./cmd/api

# ── Stage 3: Runtime ───────────────────────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata git

WORKDIR /app

COPY --from=backend /sandhilux .
COPY --from=frontend /app/dist ./web/dist

EXPOSE 8080
ENTRYPOINT ["/app/sandhilux"]
