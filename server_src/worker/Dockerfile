FROM iron/node:dev

WORKDIR /hdb-resale

ENV NPM_CONFIG_LOGLEVEL=warn

RUN npm install babel-runtime jStat lodash loess mathjs mongoose node-fetch sg-heatmap

COPY server_dist/worker ./worker
COPY server_dist/util ./util
