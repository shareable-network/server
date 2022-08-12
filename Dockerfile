FROM node:18
ENV NODE_ENV production
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN npm ci --only=production
USER node
CMD "npm" "start"
