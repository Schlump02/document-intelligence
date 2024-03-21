FROM node:16-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# run app
CMD ["node", "--experimental-modules", ".\wordCounterToFile.mjs"]
