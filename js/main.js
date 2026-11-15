const problemSelect = document.getElementById("problem-select");
const titleText = document.getElementById("problem-title");
const statementText = document.getElementById("problem-statement");
const codeBox = document.getElementById("code");
const runButton = document.getElementById("run");
const gradeButton = document.getElementById("grade");
const statusText = document.getElementById("status");
const resultText = document.getElementById("result");
const output = document.getElementById("output");

const TIME_LIMIT_MS = 5000;
const MAX_OUTPUT = 10000; // 画面に出す文字数の上限
const MAX_LINES = 1000;   // 1回の実行で受け取る行数の上限
const PROBLEM_IDS = ["001-hello", "002-double"];

let worker = null;
let workerReady = false;
let readyPromise = null;
let resolveReady = null;
let currentRun = null;     // 今実行中の情報(なければ null)
let currentProblem = null; // 今選んでいる問題
let busy = false;

// ---------- ボタンの状態 ----------
function updateButtons() {
  const disabled = !workerReady || busy;
  runButton.disabled = disabled;
  gradeButton.disabled = disabled;
}

function setBusy(value) {
  busy = value;
  updateButtons();
}

// ---------- Worker ----------
function createWorker() {
  workerReady = false;
  statusText.textContent = "Pythonを準備中…";
  updateButtons();

  readyPromise = new Promise((resolve) => {
    resolveReady = resolve;
  });

  worker = new Worker("js/worker.js");
  worker.onmessage = handleMessage;
}

function handleMessage(event) {
  const message = event.data;

  if (message.type === "ready") {
    workerReady = true;
    statusText.textContent = "準備できました!";
    updateButtons();
    resolveReady();
    return;
  }

  if (currentRun === null) return;

  if (message.type === "stdout" || message.type === "error") {
    if (message.type === "error") currentRun.hasError = true;
    if (currentRun.lines.length < MAX_LINES) {
      currentRun.lines.push(message.text);
    }
  } else if (message.type === "done") {
    currentRun.finish(false);
  }
}

// ---------- 1回実行して、結果を返す ----------
async function runOnce(code, input) {
  await readyPromise; // Workerの準備ができるまで待つ

  return new Promise((resolve) => {
    const run = { lines: [], hasError: false };
    currentRun = run;

    run.finish = (timedOut) => {
      clearTimeout(run.timerId);
      currentRun = null;
      resolve({ lines: run.lines, hasError: run.hasError, timedOut: timedOut });
    };

    // 時間切れ:Workerを止めて作り直す
    run.timerId = setTimeout(() => {
      worker.terminate();
      createWorker();
      run.finish(true);
    }, TIME_LIMIT_MS);

    worker.postMessage({ type: "run", code: code, input: input });
  });
}

// ---------- 実行ボタン ----------
runButton.addEventListener("click", async () => {
  setBusy(true);
  output.textContent = "";
  resultText.textContent = "";

  const result = await runOnce(codeBox.value, "");

  let text = result.lines.join("\n");
  if (result.timedOut) {
    text += "\n時間切れです(" + TIME_LIMIT_MS / 1000 + "秒)。";
  }
  output.textContent = text.slice(0, MAX_OUTPUT);
  setBusy(false);
});

// ---------- 採点ボタン ----------
gradeButton.addEventListener("click", async () => {
  if (currentProblem === null) return;

  setBusy(true);
  output.textContent = "";
  resultText.textContent = "採点中…";

  const tests = currentProblem.tests;
  const messages = [];
  let passedCount = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const result = await runOnce(codeBox.value, test.input);
    const actual = result.lines.join("\n").trim();
    const expected = test.expected.trim();
    const label = "ケース" + (i + 1) + ": ";

    if (result.timedOut) {
      messages.push(label + "⏱ 時間切れ");
    } else if (result.hasError) {
      messages.push(label + "❌ 実行エラー\n" + actual);
    } else if (actual === expected) {
      passedCount++;
      messages.push(label + "✅ 正解");
    } else {
      messages.push(label + "❌ 不正解(期待: " + expected + " / 実際: " + actual + ")");
    }
  }

  if (passedCount === tests.length) {
    resultText.textContent = "✅ 全部正解!";
  } else {
    resultText.textContent = "❌ " + passedCount + " / " + tests.length + " 正解";
  }
  output.textContent = messages.join("\n").slice(0, MAX_OUTPUT);
    const saveMessage = await saveResult(currentProblem.id, passedCount === tests.length, codeBox.value);
  resultText.textContent += "(" + saveMessage + ")";
  setBusy(false);
});

// ---------- 問題の読み込み ----------
async function loadProblem(id) {
  currentProblem = null;
  resultText.textContent = "";
  output.textContent = "";

  const response = await fetch("problems/" + id + ".json");
  if (!response.ok) {
    titleText.textContent = "問題を読み込めませんでした";
    statementText.textContent = "";
    return;
  }

  currentProblem = await response.json();
  titleText.textContent = currentProblem.title;
  statementText.textContent = currentProblem.statement;
}

// 問題の選択欄を作る
for (const id of PROBLEM_IDS) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = id;
  problemSelect.appendChild(option);
}
problemSelect.addEventListener("change", () => loadProblem(problemSelect.value));

// ---------- 開始 ----------
createWorker();
loadProblem(PROBLEM_IDS[0]);