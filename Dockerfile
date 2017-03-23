FROM node:6-slim

WORKDIR /hdb-resale

ENV NPM_CONFIG_LOGLEVEL=warn
ENV NODE_ENV=production

COPY package.json ./
COPY dist ./dist
COPY server_dist ./server_dist

RUN npm install --only=prod

EXPOSE 8080
CMD ["npm", "start"]
