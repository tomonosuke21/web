const problemSelect = document.getElementById("problem-select");
const titleText = document.getElementById("problem-title");
const statementText = document.getElementById("problem-statement");
const exampleContainer = document.getElementById("example-container");
const exampleContent = document.getElementById("example-content");
const testcaseTbody = document.getElementById("testcase-tbody");

const codeBox = document.getElementById("code");
const lineNumbers = document.getElementById("line-numbers");
const runButton = document.getElementById("run");
const gradeButton = document.getElementById("grade");
const resetCodeButton = document.getElementById("reset-code");
const statusText = document.getElementById("status");

const floatingConsole = document.getElementById("floating-console");
const closeConsoleBtn = document.getElementById("close-console");
const output = document.getElementById("output");

const judgeBackdrop = document.getElementById("judge-modal-backdrop");
const judgeStatusEl = document.getElementById("judge-modal-status");
const judgeTbody = document.getElementById("judge-result-tbody");
const resultText = document.getElementById("result");
const closeJudgeModalBtn = document.getElementById("close-judge-modal");
const nextProblemBtn = document.getElementById("next-problem-btn");

const MAX_OUTPUT = 10000;
const PROBLEM_IDS = ["001-hello", "002-double"];

const runner = createRunner("python");
let workerReady = false;
let currentProblem = null;
let busy = false;

const syncLineNumbers = attachLineNumbers(codeBox, lineNumbers);

function updateButtons() {
  const disabled = !workerReady || busy;
  runButton.disabled = disabled;
  gradeButton.disabled = disabled;
}

function setBusy(value) {
  busy = value;
  updateButtons();
}

runner.whenReady().then(() => {
  workerReady = true;
  statusText.textContent = "準備完了";
  updateButtons();
});

// フローティング実行結果ウィンドウの操作
closeConsoleBtn.addEventListener("click", () => {
  floatingConsole.hidden = true;
});

// ジャッジモーダルの操作
closeJudgeModalBtn.addEventListener("click", () => {
  judgeBackdrop.hidden = true;
});

judgeBackdrop.addEventListener("click", (e) => {
  if (e.target === judgeBackdrop) {
    judgeBackdrop.hidden = true;
  }
});

nextProblemBtn.addEventListener("click", () => {
  judgeBackdrop.hidden = true;
  const idx = PROBLEM_IDS.indexOf(problemSelect.value);
  if (idx >= 0 && idx + 1 < PROBLEM_IDS.length) {
    problemSelect.value = PROBLEM_IDS[idx + 1];
    loadProblem(problemSelect.value);
  }
});

resetCodeButton.addEventListener("click", () => {
  if (!currentProblem) return;
  codeBox.value = currentProblem.starter || 'print("hello")';
  syncLineNumbers();
});

// ---------- 実行ボタン（フローティング結果表示） ----------
runButton.addEventListener("click", async () => {
  setBusy(true);
  floatingConsole.hidden = false;
  output.textContent = "実行中…";

  const firstInput =
    currentProblem && Array.isArray(currentProblem.tests) && currentProblem.tests.length > 0
      ? currentProblem.tests[0].input || ""
      : "";

  const result = await runner.run(codeBox.value, firstInput);

  let text = result.lines.join("\n");
  if (result.timedOut) {
    text += "\n時間切れです(" + TIME_LIMIT_MS / 1000 + "秒)。";
  }
  if (!text.trim()) {
    text = "(出力なし)";
  }
  output.textContent = text.slice(0, MAX_OUTPUT);
  setBusy(false);
});

// ---------- ジャッジボタン（採点モーダル表示） ----------
gradeButton.addEventListener("click", async () => {
  if (currentProblem === null) return;

  setBusy(true);
  floatingConsole.hidden = true;
  judgeBackdrop.hidden = false;
  nextProblemBtn.hidden = true;
  resultText.textContent = "";

  const tests = currentProblem.tests || [];
  judgeStatusEl.className = "judge-modal-status running";
  judgeStatusEl.textContent = "Checking... (0/" + tests.length + ")";
  judgeTbody.textContent = "";

  const g = await gradeCode(runner, codeBox.value, tests, (done, total) => {
    judgeStatusEl.textContent = "Checking... (" + done + "/" + total + ")";
  });

  judgeTbody.textContent = "";
  for (const d of g.details) {
    const tr = document.createElement("tr");

    const iconTd = document.createElement("td");
    iconTd.className = "judge-icon-cell " + (d.passed ? "judge-icon-ok" : "judge-icon-ng");
    iconTd.textContent = d.passed ? "正解" : "不正解";

    const inTd = document.createElement("td");
    inTd.className = "judge-code-cell";
    inTd.textContent = d.input !== "" ? d.input : "(なし)";

    const expTd = document.createElement("td");
    expTd.className = "judge-code-cell";
    expTd.textContent = d.expected;

    const actTd = document.createElement("td");
    actTd.className = "judge-code-cell";
    actTd.textContent = d.actual;

    tr.append(iconTd, inTd, expTd, actTd);
    judgeTbody.appendChild(tr);
  }

  if (g.allPassed) {
    judgeStatusEl.className = "judge-modal-status pass";
    judgeStatusEl.textContent = "正解";
    const idx = PROBLEM_IDS.indexOf(currentProblem.id);
    if (idx >= 0 && idx + 1 < PROBLEM_IDS.length) {
      nextProblemBtn.hidden = false;
    }
  } else {
    judgeStatusEl.className = "judge-modal-status fail";
    judgeStatusEl.textContent = "不正解 (" + g.passed + " / " + g.total + " 正解)";
  }

  const saveMessage = await saveResult(currentProblem.id, g.allPassed, codeBox.value);
  resultText.textContent = saveMessage;
  setBusy(false);
});

// ---------- 問題の読み込み ----------
async function loadProblem(id) {
  currentProblem = null;
  floatingConsole.hidden = true;
  judgeBackdrop.hidden = true;
  output.textContent = "";
  testcaseTbody.textContent = "";

  const response = await fetch("problems/" + id + ".json");
  if (!response.ok) {
    titleText.textContent = "問題を読み込めませんでした";
    statementText.textContent = "";
    return;
  }

  currentProblem = await response.json();
  titleText.textContent = currentProblem.title;
  statementText.textContent = currentProblem.statement;

  if (currentProblem.starter !== undefined) {
    codeBox.value = currentProblem.starter;
  } else {
    codeBox.value = "";
  }
  syncLineNumbers();

  const tests = Array.isArray(currentProblem.tests) ? currentProblem.tests : [];
  if (tests.length > 0) {
    exampleContainer.hidden = false;
    const t0 = tests[0];
    let exText = "";
    if (t0.input) exText += "【入力】\n" + t0.input + "\n\n";
    exText += "【出力例】\n" + t0.expected;
    exampleContent.textContent = exText;

    tests.forEach((t, idx) => {
      const tr = document.createElement("tr");
      const tdNo = document.createElement("td");
      tdNo.textContent = String(idx + 1);

      const tdIn = document.createElement("td");
      const codeIn = document.createElement("code");
      codeIn.textContent = t.input || "(なし)";
      tdIn.appendChild(codeIn);

      const tdExp = document.createElement("td");
      const codeExp = document.createElement("code");
      codeExp.textContent = t.expected;
      tdExp.appendChild(codeExp);

      tr.append(tdNo, tdIn, tdExp);
      testcaseTbody.appendChild(tr);
    });
  } else {
    exampleContainer.hidden = true;
  }
}

// 問題の選択欄を作る（問題タイトルも表示）
async function initProblemSelect() {
  for (const id of PROBLEM_IDS) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    problemSelect.appendChild(option);
    try {
      const res = await fetch("problems/" + id + ".json");
      if (res.ok) {
        const data = await res.json();
        option.textContent = id + " : " + data.title;
      }
    } catch (_) {}
  }
  problemSelect.addEventListener("change", () => loadProblem(problemSelect.value));
  loadProblem(PROBLEM_IDS[0]);
}

initProblemSelect();