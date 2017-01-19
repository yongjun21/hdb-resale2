FROM node:6-slim

WORKDIR /hdb-resale

COPY package.json webpack.prod.config.js ./
ENV NPM_CONFIG_LOGLEVEL warn
RUN npm install

COPY src ./src
COPY dist ./dist
COPY server_src ./server_src
ENV NODE_ENV=production
RUN npm run build

EXPOSE 8080
CMD ["npm", "start"]
