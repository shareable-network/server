FROM node:18
USER node
ENV NODE_ENV production
WORKDIR /usr/src/app
COPY package.json .
COPY package-lock.json .
RUN npm ci --only=production
COPY .env .
COPY src .
CMD "npm" "start"
