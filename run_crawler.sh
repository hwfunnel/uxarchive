#!/bin/bash
# launchd가 매주 자동 실행하는 스크립트

cd /Users/ranranoi/Downloads/uxarchive

/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 \
  -m crawler.src.crawl \
  --csv \
  --verbose
