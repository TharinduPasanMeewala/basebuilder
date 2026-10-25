FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_BASE44_APP_ID=6a2a34f6f3a1ed50ecd8de02
ENV VITE_BASE44_APP_ID=$VITE_BASE44_APP_ID
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/hosting ./hosting
USER node
EXPOSE 3000
CMD ["node", "hosting/serve.mjs"]
