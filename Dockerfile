FROM node

# Set ENV
ENV NODE_ENV production
ENV PHANTOMJS_VERSION 2.1.1

# Commands
RUN apt-get update \
    #&& apt-get upgrade -y --force-yes \
    && apt-get install -y --force-yes --no-install-recommends \
    apt-utils \
    apt-transport-https \

    && curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
    && echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list \

    && apt-get update \
    && apt-get install -y --force-yes --no-install-recommends \
    yarn \
    wget \
    ca-certificates \
    libfreetype6 \
    libfontconfig \
    bzip2 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get -y autoclean \
    && apt-get autoremove -y \

    && wget -q --no-check-certificate -O /tmp/phantomjs-$PHANTOMJS_VERSION-linux-x86_64.tar.bz2 \
    https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-$PHANTOMJS_VERSION-linux-x86_64.tar.bz2

RUN tar -xjf /tmp/phantomjs-$PHANTOMJS_VERSION-linux-x86_64.tar.bz2 -C /tmp \
    && rm -rf /tmp/phantomjs-$PHANTOMJS_VERSION-linux-x86_64.tar.bz2 \
    && mkdir -p /srv/var \
    && mv /tmp/phantomjs-$PHANTOMJS_VERSION-linux-x86_64/ /srv/var/phantomjs \
    && ln -s /srv/var/phantomjs/bin/phantomjs /usr/bin/phantomjs

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN cd /usr/src/app/; yarn install --production

# Bundle app source
COPY . /usr/src/app

EXPOSE 3000
CMD [ "npm", "start" ]
