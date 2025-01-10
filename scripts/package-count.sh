#!/bin/bash

find . -path "*package.json" -not -path "./package.json" -type f | wc -l | xargs
