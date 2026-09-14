# syntax=docker/dockerfile:1

# ---- 依赖 ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- 构建 ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- 前端静态服务 ----
FROM nginx:1.27-alpine AS web
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

# ---- 一次性验收：单元测试 + 针对 web 服务的端到端测试 ----
FROM mcr.microsoft.com/playwright:v1.47.2-jammy AS verify
WORKDIR /app
ENV CI=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
CMD ["npm", "run", "verify"]
