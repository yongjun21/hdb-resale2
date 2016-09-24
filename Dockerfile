FROM iron/node:dev

ADD server_dist/worker /worker
ADD server_dist/util /util

RUN npm install babel-runtime jStat lodash loess mathjs mongoose node-fetch sg-heatmap
