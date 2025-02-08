#!/bin/bash

find node_modules -name package.json -type f | grep -E 'node_modules\/[^\/]+\/package.json$|node_modules/@[^\/]+\/[^\/]+\/package.json$' | wc -l | xargs
