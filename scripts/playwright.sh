#!/bin/bash

# Playwright MCP 서버 실행 스크립트
npx -y @playwright/mcp@latest --port 8931 --browser chromium $@
