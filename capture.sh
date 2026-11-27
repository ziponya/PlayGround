#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR for screenshots.}"
run() { /usr/bin/time -p "$@"; }
run mkdir -p "$CAPTURE_DIR"

# Use the worker's preinstalled headed Chromium configuration. The browser is
# launched and closed by this process; evidence is written only to CAPTURE_DIR.
run node --input-type=module <<'NODE'
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const runtime=join(process.env.HOME,'.local/share/omgithub-playwright');
const require=createRequire(join(runtime,'package.json'));
const {chromium}=require('playwright');
const config=JSON.parse(await readFile(join(runtime,process.platform==='darwin'?'metal.json':'linux.json'),'utf8'));
if(process.platform==='linux')process.env.DISPLAY ||= ':'+(await readFile(join(runtime,'display'),'utf8')).trim();
const url=process.env.CAPTURE_URL, output=process.env.CAPTURE_DIR;
const isTemporary=e=>e?.name==='TimeoutError'||/timeout|net::ERR_|ECONN|socket|browser.*(closed|disconnected)|target.*closed|failed to launch/i.test(String(e?.message||e));
let browser;
try{
  browser=await chromium.launch({...config.browser.launchOptions,timeout:30000});
  for(const [name,width,height] of [['desktop',1280,800],['mobile',390,844]]){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    const pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(e.message));
    let response;
    try{response=await page.goto(url,{waitUntil:'load',timeout:45000})}
    catch(e){if(isTemporary(e))throw Object.assign(e,{exitCode:75});throw e}
    if(!response?.ok()){
      const status=response?.status();
      throw Object.assign(new Error(`Preview returned HTTP ${status??'no response'} for ${url}`),{exitCode:!status||[408,429,500,502,503,504].includes(status)?75:1});
    }
    await page.locator('body').waitFor({state:'visible',timeout:15000});
    await page.evaluate(()=>document.fonts?document.fonts.ready.then(()=>true):true);
    const rendered=await page.waitForFunction(()=>{
      const body=document.body;
      if(!body||!document.documentElement.clientWidth)return false;
      const visible=[...body.querySelectorAll('*')].some(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>2&&r.height>2&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0});
      const text=(body.innerText||'').trim().length>0;
      const canvas=[...body.querySelectorAll('canvas')].some(c=>c.width>0&&c.height>0);
      return visible&&(text||canvas);
    },{timeout:15000}).catch(e=>{throw Object.assign(new Error(`Page loaded but no rendered content was detected: ${e.message}`),{exitCode:1})});
    void rendered;
    await page.waitForTimeout(700);
    if(pageErrors.length)throw Object.assign(new Error(`JavaScript rendering error: ${pageErrors.join('; ')}`),{exitCode:1});
    await page.screenshot({path:join(output,`final-${name}.png`),fullPage:false,timeout:30000}).catch(e=>{throw Object.assign(e,{exitCode:isTemporary(e)?75:1})});
    await page.close();
    console.log(`Captured ${name} ${width}x${height}: ${url}`);
  }
}catch(error){
  console.error(error?.stack||error);
  process.exitCode=error?.exitCode||(isTemporary(error)?75:1);
}finally{
  if(browser)try{await browser.close()}catch(error){console.error(`Browser cleanup failed: ${error.message}`);process.exitCode ||= 75}
}
NODE
