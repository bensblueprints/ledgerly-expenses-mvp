FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y python3 python3-setuptools make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY scripts ./scripts
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/tesseract.js/dist ./node_modules/tesseract.js/dist
COPY --from=build /app/node_modules/tesseract.js-core ./node_modules/tesseract.js-core
RUN node scripts/fetch-ocr-data.js || true
ENV PORT=5335
ENV DATA_DIR=/data
VOLUME /data
EXPOSE 5335
CMD ["node", "server/index.js"]
