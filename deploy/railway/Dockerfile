FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production BOS42_API_ONLY=1 HOST=0.0.0.0
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server/ ./server/
COPY shared/ ./shared/
# Bootstrap gives only the history subdirectory to the existing unprivileged user.
# start.mjs drops uid/gid before loading the API or opening any sockets.
USER root
CMD ["node", "server/start.mjs"]
