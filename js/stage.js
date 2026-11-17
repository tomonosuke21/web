const params = new URLSearchParams(window.location.search);
const stageId = Number(params.get("id"));
const fromParam = params.get("from");

const backLinkEl = document.getElementById("back-link");
const titleEl = document.getElementById("stage-title");
const bodyEl = document.getElementById("stage-body");
const messageEl = document.getElementById("stage-message");
const nextEl = document.getElementById("stage-next");

const clearOverlay = document.getElementById("stage-clear-overlay");
const clearSubEl = document.getElementById("stage-clear-sub");
const clearNextBtn = document.getElementById("stage-clear-next-btn");
const clearQuestsBtn = document.getElementById("stage-clear-quests-btn");
const clearCloseBtn = document.getElementById("stage-clear-close-btn");

let currentStage = null;
let judgeBackdropEl = null;

if (backLinkEl) {
  if (fromParam === "problems") {
    backLinkEl.href = "index.html";
    backLinkEl.textContent = "← 練習問題へ戻る";
  } else if (fromParam === "new") {
    backLinkEl.href = "new.html";
    backLinkEl.textContent = "← 新着問題へ戻る";
  }
}

clearCloseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearOverlay.hidden = true;
});

// オーバーレイのボックス内クリックが背景に伝播しないように保護（誤閉鎖防止）
const clearBox = clearOverlay.querySelector(".stage-clear-box");
if (clearBox) {
  clearBox.addEventListener("click", (e) => {
    e.stopPropagation();
  });
}

// ---------- クリアしたときの処理 ----------
async function markDone() {
  let statusNote = "";
  messageEl.textContent = "🎉 ステージクリア！";

  if (currentUser === null) {
    statusNote = "ログインすると進捗が保存されます";
    messageEl.textContent += " (" + statusNote + ")";
  } else {
    const { error } = await db.from("stage_progress").insert({ stage_id: currentStage.id });
    if (error && error.code !== "23505") {
      console.error(error);
      statusNote = "進捗の保存に失敗しました";
      messageEl.textContent += " (" + statusNote + ")";
    } else {
      statusNote = "クリア記録を保存しました！";
    }
  }

  clearSubEl.textContent = statusNote;
  if (judgeBackdropEl) {
    judgeBackdropEl.hidden = true;
  }
  clearOverlay.hidden = false;

  await showNext();
}

// 次のステージ(なければ、一覧)へのリンクを出す
async function showNext() {
  const { data } = await db
    .from("stages")
    .select("id")
    .eq("quest_id", currentStage.quest_id)
    .gt("position", currentStage.position)
    .order("position")
    .limit(1);

  const link = el("a");
  const fromSuffix = fromParam ? "&from=" + encodeURIComponent(fromParam) : "";

  if (fromParam === "problems") {
    clearQuestsBtn.href = "index.html";
    clearQuestsBtn.textContent = "練習問題一覧に戻る";
  } else if (fromParam === "new") {
    clearQuestsBtn.href = "new.html";
    clearQuestsBtn.textContent = "新着問題一覧に戻る";
  } else {
    clearQuestsBtn.href = "quest.html?id=" + currentStage.quest_id;
    clearQuestsBtn.textContent = "クエスト詳細に戻る";
  }

  if (data && data.length > 0) {
    const nextUrl = "stage.html?id=" + data[0].id + fromSuffix;
    link.href = nextUrl;
    link.textContent = "次のステージへ →";

    clearNextBtn.href = nextUrl;
    clearNextBtn.hidden = false;
  } else {
    link.href = clearQuestsBtn.href;
    link.textContent = clearQuestsBtn.textContent;

    clearNextBtn.hidden = true;
  }
  nextEl.textContent = "";
  nextEl.appendChild(link);
}

// ---------- スタディ(スライド) ----------
function renderStudy(content) {
  bodyEl.className = "center-card";
  const slides = Array.isArray(content.slides) ? content.slides : [];
  if (slides.length === 0) {
    bodyEl.textContent = "スライドがありません";
    return;
  }

  let index = 0;
  const heading = el("h3");
  const text = el("p");
  text.style.whiteSpace = "pre-wrap";
  const code = el("pre");
  code.className = "example-code";
  const counter = el("p");
  counter.style.textAlign = "center";
  counter.style.fontWeight = "600";

  const navRow = el("div");
  navRow.style.display = "flex";
  navRow.style.justifyContent = "center";
  navRow.style.gap = "12px";
  navRow.style.marginTop = "20px";

  const prevButton = el("button", "← 前へ");
  prevButton.className = "secondary";
  const nextButton = el("button");
  navRow.append(prevButton, nextButton);

  function show() {
    const slide = slides[index];
    heading.textContent = slide.title || "";
    text.textContent = slide.text || "";
    code.textContent = slide.code || "";
    code.hidden = !slide.code;
    counter.textContent = (index + 1) + " / " + slides.length;
    prevButton.disabled = index === 0;
    nextButton.textContent = index === slides.length - 1 ? "完了する" : "次へ →";
  }

  prevButton.addEventListener("click", () => {
    index--;
    show();
  });
  nextButton.addEventListener("click", () => {
    if (index < slides.length - 1) {
      index++;
      show();
    } else {
      nextButton.disabled = true;
      markDone();
    }
  });

  bodyEl.append(heading, text, code, counter, navRow);
  show();
}

// ---------- 穴埋めテスト ----------
function renderFill(content) {
  bodyEl.className = "center-card";
  const blanks = Array.isArray(content.blanks) ? content.blanks : [];
  const parts = String(content.template || "").split("___");

  const pre = el("pre");
  pre.style.background = "#282a36";
  pre.style.color = "#f8f8f2";
  pre.style.padding = "18px";
  pre.style.borderRadius = "10px";
  pre.style.lineHeight = "2.2";

  const inputs = [];
  parts.forEach((part, i) => {
    pre.append(part);
    if (i < parts.length - 1) {
      const input = el("input");
      input.type = "text";
      input.size = 10;
      input.style.padding = "4px 8px";
      input.style.margin = "0 4px";
      inputs.push(input);
      pre.append(input);
    }
  });

  const checkButton = el("button", "✓ 答え合わせ");
  const result = el("p");
  result.style.fontWeight = "700";

  checkButton.addEventListener("click", () => {
    const allCorrect =
      inputs.length === blanks.length &&
      inputs.every((input, i) => input.value.trim() === String(blanks[i]).trim());

    if (allCorrect) {
      checkButton.disabled = true;
      result.style.color = "var(--success)";
      result.textContent = "正解";
      markDone();
    } else {
      result.style.color = "var(--danger)";
      result.textContent = "不正解";
    }
  });

  const stmt = el("p", content.statement || "");
  stmt.style.whiteSpace = "pre-wrap";
  bodyEl.append(stmt, pre, checkButton, result);
}

// ---------- 練習問題(トイプロ風実行環境とジャッジモーダル) ----------
function renderProblem(content, language) {
  if (!WORKER_FILES[language]) {
    bodyEl.className = "center-card";
    bodyEl.textContent = "この言語は、まだ対応していません";
    return;
  }

  bodyEl.className = "ide-workspace";
  const tests = Array.isArray(content.tests) ? content.tests : [];
  const requirements = Array.isArray(content.requirements) ? content.requirements : [];
  const runner = createRunner(language);

  // 左ペイン
  const leftPane = el("section");
  leftPane.className = "ide-left-pane";

  const floatingConsole = el("div");
  floatingConsole.className = "floating-console";
  floatingConsole.hidden = true;

  const consoleHeader = el("div");
  consoleHeader.className = "floating-console-header";
  const closeConsoleBtn = el("button", "✕");
  closeConsoleBtn.className = "floating-console-close";
  closeConsoleBtn.addEventListener("click", () => {
    floatingConsole.hidden = true;
  });
  consoleHeader.append(el("span", "実行結果"), closeConsoleBtn);

  const output = el("pre");
  output.className = "floating-console-body";
  floatingConsole.append(consoleHeader, output);

  const probHeader = el("div");
  probHeader.className = "problem-header";
  probHeader.append(el("h2", currentStage.title || "練習問題"));

  const stmt = el("p", content.statement || "");
  stmt.className = "problem-statement";

  leftPane.append(floatingConsole, probHeader, stmt);

  if (tests.length > 0) {
    const exBox = el("div");
    exBox.className = "example-box";
    const exCode = el("pre");
    exCode.className = "example-code";
    let exText = "";
    if (tests[0].input) exText += "【入力】\n" + tests[0].input + "\n\n";
    exText += "【出力例】\n" + tests[0].expected;
    exCode.textContent = exText;
    exBox.append(el("h4", "入力例 / 出力例"), exCode);
    leftPane.append(exBox);
  }

  // 右ペイン
  const rightPane = el("section");
  rightPane.className = "ide-right-pane";

  const editorBox = el("div");
  editorBox.className = "ide-editor-box";

  const toolbar = el("div");
  toolbar.className = "ide-toolbar";

  const tbLeft = el("div");
  tbLeft.className = "ide-toolbar-left";

  const runButton = el("button");
  runButton.className = "ide-btn ide-btn-run";
  const runIcon = el("span", "▶");
  runIcon.className = "icon";
  runButton.append(runIcon, " 実行");

  const judgeButton = el("button");
  judgeButton.className = "ide-btn ide-btn-judge";
  const judgeIcon = el("span", "✓");
  judgeIcon.className = "icon";
  judgeButton.append(judgeIcon, " ジャッジ");

  tbLeft.append(runButton, judgeButton);

  const tbRight = el("div");
  tbRight.className = "ide-toolbar-right";
  const statusBadge = el("span", "準備中…");
  statusBadge.className = "ide-status-badge";
  const resetBtn = el("button", "初期化");
  resetBtn.className = "ide-btn";
  tbRight.append(statusBadge, resetBtn);

  toolbar.append(tbLeft, tbRight);

  const textareaWrap = el("div");
  textareaWrap.className = "ide-textarea-wrap";
  const gutter = el("div", "1");
  gutter.className = "ide-gutter";
  const editor = el("textarea");
  editor.className = "ide-code-input";
  editor.spellcheck = false;

  const syncLines = attachLineNumbers(editor, gutter);
  textareaWrap.append(gutter, editor);
  editorBox.append(toolbar, textareaWrap);
  rightPane.append(editorBox);

  // テストケース表
  if (tests.length > 0) {
    const tcPanel = el("div");
    tcPanel.className = "testcase-panel";
    const table = el("table");
    table.className = "testcase-table";
    const thead = el("thead");
    const headTr = el("tr");
    const thNo = el("th", "No");
    thNo.style.width = "50px";
    headTr.append(thNo, el("th", "入力"), el("th", "期待する結果"));
    thead.append(headTr);

    const tbody = el("tbody");
    tests.forEach((t, i) => {
      const tr = el("tr");
      const cIn = el("code", t.input || "(なし)");
      const tdIn = el("td");
      tdIn.append(cIn);
      const cExp = el("code", String(t.expected));
      const tdExp = el("td");
      tdExp.append(cExp);
      tr.append(el("td", String(i + 1)), tdIn, tdExp);
      tbody.append(tr);
    });
    table.append(thead, tbody);
    tcPanel.append(el("h4", "テストケース一覧"), table);
    rightPane.append(tcPanel);
  }

  // ジャッジモーダル
  const backdrop = el("div");
  backdrop.className = "judge-modal-backdrop";
  backdrop.hidden = true;
  judgeBackdropEl = backdrop;
  const modal = el("div");
  modal.className = "judge-modal";
  modal.addEventListener("click", (e) => e.stopPropagation());
  const modalStatus = el("div", "ジャッジ中");
  modalStatus.className = "judge-modal-status running";

  const resTable = el("table");
  resTable.className = "judge-result-table";
  const resThead = el("thead");
  const resHeadTr = el("tr");
  const thIcon = el("th", "");
  thIcon.style.width = "44px";
  resHeadTr.append(thIcon, el("th", "入力"), el("th", "期待する結果"), el("th", "実行結果"));
  resThead.append(resHeadTr);
  const resTbody = el("tbody");
  resTable.append(resThead, resTbody);

  const modalActions = el("div");
  modalActions.className = "judge-modal-actions";
  const closeModalBtn = el("button", "閉じる");
  closeModalBtn.className = "secondary";
  closeModalBtn.addEventListener("click", () => {
    backdrop.hidden = true;
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.hidden = true;
  });
  modalActions.append(closeModalBtn);
  modal.append(modalStatus, resTable, modalActions);
  backdrop.append(modal);

  bodyEl.append(leftPane, rightPane, backdrop);

  function setBusy(busy) {
    runButton.disabled = busy;
    judgeButton.disabled = busy;
  }

  setBusy(true);
  runner.whenReady().then(() => {
    setBusy(false);
    statusBadge.textContent = "準備完了";
  });

  runButton.addEventListener("click", async () => {
    setBusy(true);
    floatingConsole.hidden = false;
    output.textContent = "実行中";

    const firstIn = tests.length > 0 ? tests[0].input || "" : "";
    const r = await runner.run(editor.value, firstIn);
    let text = r.lines.join("\n");
    if (r.timedOut) text += "\n時間切れです(" + TIME_LIMIT_MS / 1000 + "秒)。";
    if (!text.trim()) text = "(出力なし)";
    output.textContent = text.slice(0, 10000);
    setBusy(false);
  });

  judgeButton.addEventListener("click", async () => {
    setBusy(true);
    floatingConsole.hidden = true;
    backdrop.hidden = false;
    modalStatus.className = "judge-modal-status running";
    modalStatus.textContent = "ジャッジ中 (0/" + tests.length + ")";
    resTbody.textContent = "";

    const g = await gradeCodeWithRules(runner, editor.value, tests, requirements, (done, total) => {
      modalStatus.textContent = "ジャッジ中 (" + done + "/" + total + ")";
    });

    resTbody.textContent = "";
    for (const rr of g.ruleResults) {
      const tr = el("tr");
      const iconTd = el("td", rr.passed ? "✓" : "✕");
      iconTd.className = "judge-icon-cell " + (rr.passed ? "judge-icon-ok" : "judge-icon-ng");
      const labelTd = el("td", rr.label);
      labelTd.colSpan = 3;
      tr.append(iconTd, labelTd);
      resTbody.append(tr);
    }

    for (const d of g.details) {
      const tr = el("tr");
      const iconTd = el("td", d.passed ? "✓" : "✕");
      iconTd.className = "judge-icon-cell " + (d.passed ? "judge-icon-ok" : "judge-icon-ng");

      const inTd = el("td", d.input !== "" ? d.input : "(なし)");
      inTd.className = "judge-code-cell";
      const expTd = el("td", d.expected);
      expTd.className = "judge-code-cell";
      const actTd = el("td", d.actual);
      actTd.className = "judge-code-cell";

      tr.append(iconTd, inTd, expTd, actTd);
      resTbody.append(tr);
    }

    if (g.allPassed) {
      modalStatus.className = "judge-modal-status pass";
      modalStatus.textContent = "正解";
      markDone();
    } else {
      modalStatus.className = "judge-modal-status fail";
      modalStatus.textContent = "不正解(" + g.passed + " / " + g.total + " 正解)";
    }
    setBusy(false);
  });
}

// ---------- ステージを読み込んで表示 ----------
async function loadStage() {
  if (!Number.isInteger(stageId) || stageId <= 0) {
    bodyEl.className = "center-card";
    bodyEl.textContent = "ステージが指定されていません";
    return;
  }

  const { data, error } = await db
    .from("stages")
    .select("id, quest_id, position, kind, title, content, quests(title, language)")
    .eq("id", stageId)
    .single();

  if (error || !data) {
    console.error(error);
    titleEl.textContent = "ステージ";
    bodyEl.className = "center-card";
    bodyEl.textContent = "ステージを読み込めませんでした";
    return;
  }

  currentStage = data;
  if (backLinkEl && fromParam !== "problems" && fromParam !== "new") {
    backLinkEl.href = "quest.html?id=" + data.quest_id;
    backLinkEl.textContent = "← クエストへ戻る";
  }
  titleEl.textContent = data.quests.title + " / " + data.title;
  bodyEl.textContent = "";

  if (data.kind === "study") renderStudy(data.content);
  else if (data.kind === "fill") renderFill(data.content);
  else if (data.kind === "problem") renderProblem(data.content, data.quests.language);
}

loadStage();
