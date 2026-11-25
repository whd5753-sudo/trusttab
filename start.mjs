#!/usr/bin/env node
// TrustTab 실행기 — 명령 하나(또는 TrustTab.cmd 더블클릭)로 필요한 것을 모두 켠다.
//
//   npm start            AI 오라클을 켜고, 배포된 TrustTab 사이트를 Edge 로 연다      (시연 · 평소)
//   npm run dev          오라클 + 화면 개발 서버를 켜고 http://trusttab.localhost:5173/ 을 연다 (화면 고칠 때)
//   npm run oracle       오라클만 켠다 (브라우저 안 열기)
//
// 옵션: --dev  --oracle-only  --no-open  --browser=default (Edge 대신 기본 브라우저)  --url=<주소>
// 끄기: 이 창에서 Ctrl+C (켠 것을 모두 같이 끈다)
//
// 개인키(oracle/.env)는 이 파일이 읽지 않는다. 있는지만 확인하고, 읽기는 오라클 서버(oracle/server.mjs)가 한다.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const ORACLE_DIR = join(ROOT, "oracle");
const WEB_DIR = join(ROOT, "web");
const ORACLE_HEALTH = "http://127.0.0.1:8787/health";
const DEV_PORT = 5173;
const DEV_URL = `http://trusttab.localhost:${DEV_PORT}/`;
const PUBLIC_RPC = process.env.TRUSTTAB_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com"; // 시험용으로 바꿀 수 있음
const SELECTOR_ORACLE = "0x7dc0d1d0"; // oracle() — 컨트랙트에 등록된 오라클 주소
const SELECTOR_PAUSED = "0x5c975abb"; // paused()
const isWindows = process.platform === "win32";

// ---------------------------------------------------------------- 순수 함수 (start.test.mjs 에서 시험)

/** 명령줄 옵션 읽기 */
export function parseArgs(argv) {
  const opts = { dev: false, oracleOnly: false, open: true, browser: "edge", url: null };
  for (const arg of argv) {
    if (arg === "--dev" || arg === "dev") opts.dev = true;
    else if (arg === "--oracle-only" || arg === "oracle") opts.oracleOnly = true;
    else if (arg === "--no-open") opts.open = false;
    else if (arg === "--browser=default") opts.browser = "default";
    else if (arg.startsWith("--url=")) opts.url = arg.slice("--url=".length);
    else if (arg === "--help" || arg === "-h" || arg === "help") opts.help = true;
    else throw new Error(`모르는 옵션: ${arg}  (도움말: npm start -- --help)`);
  }
  if (opts.dev && opts.oracleOnly) throw new Error("--dev 와 --oracle-only 는 같이 쓸 수 없습니다");
  return opts;
}

/** .git/config 의 origin 주소에서 GitHub 계정 · 저장소 이름 꺼내기 */
export function parseGitRemote(configText) {
  const section = configText.split(/^\[/m).find((s) => s.startsWith('remote "origin"'));
  const url = section?.match(/^\s*url\s*=\s*(.+)$/m)?.[1]?.trim();
  if (!url) return null;
  const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** GitHub Pages 주소 (vite.config.js 의 규칙과 같게: <계정>.github.io 저장소는 맨 앞) */
export function pagesUrl({ owner, repo }) {
  const host = `${owner.toLowerCase()}.github.io`;
  return repo.toLowerCase() === host ? `https://${host}/` : `https://${host}/${repo}/`;
}

/** eth_call 결과(32바이트)의 마지막 20바이트 = 주소 */
export function wordToAddress(hex) {
  if (typeof hex !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hex)) return null;
  return "0x" + hex.slice(-40);
}

// ---------------------------------------------------------------- 화면 출력

const color = (code) => (text) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = color(32);
const yellow = color(33);
const red = color(31);
const cyan = color(36);
const dim = color(2);
const say = (msg = "") => console.log(msg);
const ok = (msg) => say(`${green("✔")} ${msg}`);
const warn = (msg) => say(`${yellow("!")} ${msg}`);
const fail = (msg) => say(`${red("✖")} ${msg}`);

// ---------------------------------------------------------------- 실행 도구

const children = new Set();

function run(command, args, cwd, label) {
  // Windows 의 npm 은 npm.cmd 라서 shell 로 실행해야 한다
  // 맥 · 리눅스는 새 프로세스 그룹으로 띄워 끌 때 손자 프로세스(vite 등)까지 같이 끈다
  const child = spawn(command, args, { cwd, shell: isWindows && command === "npm", env: process.env, detached: !isWindows });
  children.add(child);
  child.on("exit", () => children.delete(child));
  const prefix = dim(`[${label}] `);
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) if (line.trim()) say(prefix + line);
    });
  }
  return child;
}

function stopAll() {
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (isWindows) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
  }
}

function npmInstall(dir, label) {
  if (existsSync(join(dir, "node_modules"))) return true;
  say(`${cyan("…")} ${label}: 처음 실행이라 설치합니다 (npm ci, 1~2분)`);
  const r = spawnSync("npm", ["ci"], { cwd: dir, stdio: "inherit", shell: isWindows });
  if (r.status !== 0) {
    fail(`${label} 설치 실패 — ${dir} 에서 npm install 을 직접 실행해 보세요`);
    return false;
  }
  return true;
}

async function getJson(url, timeoutMs = 1500) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function isUp(url, timeoutMs = 1500) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitFor(check, seconds) {
  for (let i = 0; i < seconds * 4; i++) {
    const value = await check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

async function ethCall(to, data) {
  try {
    const res = await fetch(PUBLIC_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      signal: AbortSignal.timeout(6000),
    });
    return (await res.json()).result ?? null;
  } catch {
    return null;
  }
}

function edgePath() {
  if (!isWindows) return null;
  const candidates = [
    join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Microsoft\\Edge\\Application\\msedge.exe"),
    join(process.env.ProgramFiles ?? "C:\\Program Files", "Microsoft\\Edge\\Application\\msedge.exe"),
    join(process.env.LOCALAPPDATA ?? "", "Microsoft\\Edge\\Application\\msedge.exe"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function openBrowser(url, browser) {
  const edge = browser === "edge" ? edgePath() : null;
  try {
    if (edge) spawn(edge, [url], { detached: true, stdio: "ignore" }).unref();
    else if (isWindows)
      spawn("cmd.exe", ["/d", "/s", "/c", `start "" "${url}"`], { detached: true, stdio: "ignore", windowsVerbatimArguments: true }).unref();
    else spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    ok(`브라우저로 열었습니다: ${cyan(url)}${edge ? " (Edge — MetaMask 가 있는 브라우저)" : ""}`);
  } catch {
    warn(`브라우저를 열지 못했습니다. 직접 여세요: ${url}`);
  }
}

// ---------------------------------------------------------------- 단계

function printHelp() {
  say(`TrustTab 실행기

  npm start                오라클 + 배포 사이트 열기 (Edge)
  npm run dev              오라클 + 화면 개발 서버 + ${DEV_URL}
  npm run oracle           오라클만
  옵션: --no-open  --browser=default  --url=<주소>
  끄기: Ctrl+C`);
}

function preflight() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 12)) {
    fail(`Node ${process.versions.node} — 20.12 이상이 필요합니다 (.env 읽기 기능). https://nodejs.org 에서 LTS 설치`);
    return false;
  }
  if (!existsSync(join(ORACLE_DIR, ".env"))) {
    fail("oracle/.env 가 없습니다 (오라클 서명 키).");
    say("  - 처음이라면: cd oracle → npm run keygen → 나온 주소로 컨트랙트를 배포해야 합니다 (docs/오라클설계.md 6절)");
    say("  - 이미 배포한 컨트랙트를 쓰려면 그때 만든 oracle/.env 를 다시 넣어야 합니다 (새로 만들면 서명이 맞지 않음)");
    return false;
  }
  return true;
}

async function startOracle() {
  const running = await getJson(ORACLE_HEALTH);
  if (running?.ok) {
    ok(`AI 오라클이 이미 켜져 있습니다 (오라클 ${running.oracle})`);
    return running;
  }
  if (!npmInstall(ORACLE_DIR, "오라클")) return null;
  const child = run(process.execPath, ["server.mjs"], ORACLE_DIR, "오라클");
  let exited = false;
  child.on("exit", (code) => {
    exited = true;
    if (code) fail(`오라클 서버가 멈췄습니다 (코드 ${code}). 8787 번 포트를 다른 프로그램이 쓰는지 확인하세요`);
  });
  const health = await waitFor(async () => {
    if (exited) return "exited";
    const h = await getJson(ORACLE_HEALTH);
    return h?.ok ? h : null;
  }, 15);
  if (!health || health === "exited") {
    fail("AI 오라클을 켜지 못했습니다 (위 [오라클] 줄의 안내를 보세요)");
    return null;
  }
  ok(`AI 오라클 켜짐: http://localhost:8787 (오라클 ${health.oracle})`);
  return health;
}

// 컨트랙트에 등록된 오라클 주소와 지금 켠 오라클 주소가 같은지 (다르면 모든 리뷰 제출이 서명 오류)
async function checkChain(health) {
  const registered = wordToAddress(await ethCall(health.contract, SELECTOR_ORACLE));
  if (!registered) {
    warn("블록체인에 접속하지 못해 오라클 등록 확인을 건너뜁니다 (인터넷 확인)");
    return;
  }
  if (registered.toLowerCase() === String(health.oracle).toLowerCase()) ok("컨트랙트에 등록된 오라클과 같습니다 (서명이 통과됩니다)");
  else {
    fail(`오라클 주소가 다릅니다: 컨트랙트 ${registered} · 지금 ${health.oracle}`);
    say("  → oracle/.env 를 새로 만들었다면 리뷰 제출이 'AI 오라클 서명이 맞지 않습니다' 로 실패합니다");
  }
  const paused = await ethCall(health.contract, SELECTOR_PAUSED);
  if (paused && BigInt(paused) !== 0n) warn("컨트랙트가 '긴급 정지' 상태입니다 — 관리자 화면(/admin/ops)에서 다시 켜세요");
}

async function startWeb() {
  if (await isUp(`http://localhost:${DEV_PORT}/`)) {
    ok(`화면 개발 서버가 이미 켜져 있습니다 (${DEV_URL})`);
    return true;
  }
  if (!npmInstall(WEB_DIR, "화면")) return false;
  const child = run("npm", ["run", "dev"], WEB_DIR, "화면");
  let exited = false;
  child.on("exit", (code) => {
    exited = true;
    if (code) fail(`화면 개발 서버가 멈췄습니다 (코드 ${code}). ${DEV_PORT} 번 포트를 다른 창이 쓰는지 확인하세요`);
  });
  const up = await waitFor(async () => exited || (await isUp(`http://localhost:${DEV_PORT}/`)), 40);
  if (!up || exited) return false;
  ok(`화면 개발 서버 켜짐: ${DEV_URL}`);
  return true;
}

function siteUrl(opts) {
  if (opts.url) return opts.url;
  if (opts.dev) return DEV_URL;
  try {
    const remote = parseGitRemote(readFileSync(join(ROOT, ".git", "config"), "utf8"));
    if (remote) return pagesUrl(remote);
  } catch {
    /* .git 이 없으면 아래 기본값 */
  }
  return "https://whd5753-sudo.github.io/trusttab/";
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    fail(e.message);
    process.exit(1);
  }
  if (opts.help) return printHelp();

  say(cyan("TrustTab 실행기") + dim(`  (${opts.dev ? "개발 모드" : opts.oracleOnly ? "오라클만" : "시연 모드"} · 끄려면 Ctrl+C)`));
  if (!preflight()) process.exit(1);

  const health = await startOracle();
  if (!health) {
    stopAll();
    process.exit(1);
  }
  if (health.chainId !== 11155111) warn(`오라클 체인이 Sepolia 가 아닙니다 (${health.chainId}) — 로컬 Hardhat 시험 중이면 괜찮습니다`);
  await checkChain(health);

  if (opts.dev && !(await startWeb())) {
    stopAll();
    process.exit(1);
  }

  if (!opts.oracleOnly) {
    const url = siteUrl(opts);
    if (opts.open) openBrowser(url, opts.browser);
    else ok(`주소: ${cyan(url)}`);
  }
  say();
  say(green("준비 완료.") + " 이 창은 켜 둔 채로 두세요. 끝낼 때 Ctrl+C");
  if (children.size === 0) {
    say(dim("(이미 켜져 있던 것을 그대로 쓰므로 이 창은 닫아도 됩니다)"));
    return;
  }
  // 켠 프로그램이 모두 끝나면 실행기도 끝난다
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (children.size === 0) {
        clearInterval(timer);
        resolve();
      }
    }, 500);
  });
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    say("\n끄는 중…");
    stopAll();
    process.exit(0);
  });
}
process.on("exit", stopAll);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    fail(`예상 못 한 오류: ${e?.message ?? e}`);
    stopAll();
    process.exit(1);
  });
}
