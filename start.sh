#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"
export PORT
cd "$PROJECT_DIR"
run() { /usr/bin/time -p "$@"; }
run pwd
run npm install --no-audit --no-fund --ignore-scripts
run npm run build
WEB_DIR="${OPENCODE_WEB_DIR:?OPENCODE_WEB_DIR must be set by the worker}"
export PROJECT_DIR OPENCODE_WEB_DIR="$WEB_DIR"
run mkdir -p "$WEB_DIR"
run node --input-type=module -e 'import {writeFileSync} from "node:fs"; const d=`${process.env.PROJECT_DIR}/dist`; writeFileSync(`${process.env.OPENCODE_WEB_DIR}/deployment-output.json`, JSON.stringify({project:"/home/runner/work/PlayGround/PlayGround",directory:d}));'
run node --input-type=module -e '
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, resolve, join } from "node:path";
const root=resolve(process.cwd(),"dist"), mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8"};
createServer((req,res)=>{try{const path=resolve(root,"."+decodeURIComponent(new URL(req.url,"http://localhost").pathname));if(path!==root&&!path.startsWith(root+"/")){res.writeHead(403);res.end();return}const file=statSync(path).isDirectory()?join(path,"index.html"):path;res.setHeader("Content-Type",mime[extname(file)]||"application/octet-stream");res.setHeader("Cache-Control","no-store");res.end(readFileSync(file))}catch{res.writeHead(404);res.end("Not found")}}).listen(Number(process.env.PORT),"0.0.0.0",()=>console.log(`Serving ${root} on port ${process.env.PORT}`));'
