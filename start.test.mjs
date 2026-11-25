// TrustTab 실행기 테스트 (node --test) — 주소 계산 · 옵션 · 블록체인 응답 읽기
import { test } from "node:test";
import assert from "node:assert/strict";
import { pagesUrl, parseArgs, parseGitRemote, wordToAddress } from "./start.mjs";

const CONFIG = `[core]
\trepositoryformatversion = 0
[remote "origin"]
\turl = https://github.com/whd5753-sudo/trusttab.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
\tremote = origin
`;

test("L1 .git/config 에서 저장소 이름을 읽어 Pages 주소를 만든다", () => {
  const remote = parseGitRemote(CONFIG);
  assert.deepEqual(remote, { owner: "whd5753-sudo", repo: "trusttab" });
  assert.equal(pagesUrl(remote), "https://whd5753-sudo.github.io/trusttab/");
});

test("L2 이름을 바꾸기 전(fairreview-dapp) · ssh 주소 · <계정>.github.io 저장소", () => {
  assert.equal(
    pagesUrl(parseGitRemote(CONFIG.replace("trusttab.git", "fairreview-dapp.git"))),
    "https://whd5753-sudo.github.io/fairreview-dapp/",
  );
  assert.deepEqual(parseGitRemote(CONFIG.replace("https://github.com/", "git@github.com:")), {
    owner: "whd5753-sudo",
    repo: "trusttab",
  });
  assert.equal(pagesUrl({ owner: "Whd5753-Sudo", repo: "whd5753-sudo.github.io" }), "https://whd5753-sudo.github.io/");
  assert.equal(parseGitRemote("[core]\n"), null);
});

test("L3 옵션: 기본 = 시연 모드, dev · oracle · --no-open, 모르는 옵션은 오류", () => {
  assert.deepEqual(parseArgs([]), { dev: false, oracleOnly: false, open: true, browser: "edge", url: null });
  assert.equal(parseArgs(["--dev"]).dev, true);
  assert.equal(parseArgs(["dev"]).dev, true);
  assert.equal(parseArgs(["--oracle-only", "--no-open"]).oracleOnly, true);
  assert.equal(parseArgs(["--browser=default"]).browser, "default");
  assert.equal(parseArgs(["--url=http://x/"]).url, "http://x/");
  assert.throws(() => parseArgs(["--mainnet"]), /모르는 옵션/);
  assert.throws(() => parseArgs(["--dev", "--oracle-only"]), /같이 쓸 수 없습니다/);
});

test("L4 eth_call 결과에서 주소 꺼내기 (형식이 틀리면 null)", () => {
  const word = "0x00000000000000000000000037eefe78d2e742208bfe1a1f688b2b385d7e5a28";
  assert.equal(wordToAddress(word), "0x37eefe78d2e742208bfe1a1f688b2b385d7e5a28");
  assert.equal(wordToAddress("0x"), null);
  assert.equal(wordToAddress(null), null);
});
