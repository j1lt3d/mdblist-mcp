# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev \
    && chmod -R a+rX,go-w package.json node_modules dist

FROM node:24-alpine
# Defaults to stdio; set MCP_TRANSPORT=http to serve Streamable HTTP on $PORT at /mcp.
ENV NODE_ENV=production MCP_HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Unprivileged built-in "node" user (uid 1000); app files stay root-owned and read-only to it.
USER 1000:1000
EXPOSE 3000
ENTRYPOINT ["node", "dist/index.js"]
