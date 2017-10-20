FROM ubuntu:16.04

RUN apt-get update && apt-get install -y git python-pip wget mongodb

RUN pip install sh

RUN git clone https://github.com/danielpuschmann/bae-logic-proxy-test.git

WORKDIR bae-logic-proxy-test

RUN wget https://nodejs.org/dist/v6.9.1/node-v6.9.1-linux-x64.tar.xz

RUN tar -xvf node-v6.9.1-linux-x64.tar.xz

RUN echo 'export PATH=$PATH:/bae-logic-proxy-test/node-v6.9.1-linux-x64/bin' >> ~/.bashrc

RUN git checkout develop

RUN mkdir indexes
VOLUME /bae-logic-proxy-test/indexes

RUN export PATH=$PATH:/bae-ecosystem-logic-proxy-test/node-v6.9.1-linux-x64/bin; npm install

RUN cp config.js.template config.js

COPY ./entrypoint.py /
COPY ./entrypoint.sh /

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
