#!/bin/bash

service mongodb start

python /entrypoint.py

sleep 15

echo "Creating indexes..."
/bae-logic-proxy-test/node-v6.9.1-linux-x64/bin/node fill_indexes.js
/bae-logic-proxy-test/node-v6.9.1-linux-x64/bin/node server.js
