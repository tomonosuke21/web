const params = new URLSearchParams(window.location.search);
const stageId = Number(params.get("id"));

const titleEl = document.getElementById("stage-title");
const bodyEl = document.getElementById("stage-body");
const messageEl = document.getElementById("stage-message");
const nextEl = document.getElementById("stage-next");

let currentStage = null;

// ---------- クリアしたときの処理 ----------
async function markDone() {
  messageEl.textContent = "🎉 クリア!";

  if (currentUser === null) {
    messageEl.textContent += "(ログインすると、進捗が保存されます)";
  } else {
    const { error } = await db.from("stage_progress").insert({ stage_id: currentStage.id });
    // 23505 は「すでにクリア済み」というエラーなので、問題ありません
    if (error && error.code !== "23505") {
      console.error(error);
      messageEl.textContent += "(保存に失敗しました)";
    }
  }
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
  if (data && data.length > 0) {
    link.href = "stage.html?id=" + data[0].id;
    link.textContent = "次のステージへ →";
  } else {
    link.href = "quests.html";
    link.textContent = "クエスト一覧へ戻る";
  }
  nextEl.textContent = "";
  nextEl.appendChild(link);
}

// ---------- スタディ(スライド) ----------
function renderStudy(content) {
  const slides = Array.isArray(content.slides) ? content.slides : [];
  if (slides.length === 0) {
    bodyEl.textContent = "スライドがありません";
    return;
  }

  let index = 0;
  const heading = el("h3");
  const text = el("p");
  const code = el("pre");
  const counter = el("p");
  const prevButton = el("button", "前へ");
  const nextButton = el("button");

  function show() {
    const slide = slides[index];
    heading.textContent = slide.title || "";
    text.textContent = slide.text || "";
    code.textContent = slide.code || "";
    code.hidden = !slide.code;
    counter.textContent = (index + 1) + " / " + slides.length;
    prevButton.disabled = index === 0;
    nextButton.textContent = index === slides.length - 1 ? "完了する" : "次へ";
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

  bodyEl.append(heading, text, code, counter, prevButton, nextButton);
  show();
}

// ---------- 穴埋めテスト ----------
function renderFill(content) {
  const blanks = Array.isArray(content.blanks) ? content.blanks : [];
  const parts = String(content.template || "").split("___");

  // コードを、文字と入力欄に分けて並べる
  const pre = el("pre");
  const inputs = [];
  parts.forEach((part, i) => {
    pre.append(part);
    if (i < parts.length - 1) {
      const input = el("input");
      input.type = "text";
      input.size = 10;
      inputs.push(input);
      pre.append(input);
    }
  });

  const checkButton = el("button", "答え合わせ");
  const result = el("p");

  checkButton.addEventListener("click", () => {
    const allCorrect =
      inputs.length === blanks.length &&
      inputs.every((input, i) => input.value.trim() === String(blanks[i]).trim());

    if (allCorrect) {
      checkButton.disabled = true;
      result.textContent = "✅ 正解!";
      markDone();
    } else {
      result.textContent = "❌ もう一度考えてみよう";
    }
  });

  bodyEl.append(el("p", content.statement || ""), pre, checkButton, result);
}

// ---------- 練習問題(実行とジャッジ) ----------
function renderProblem(content, language) {
  if (!WORKER_FILES[language]) {
    bodyEl.textContent = "この言語は、まだ対応していません";
    return;
  }

  const tests = Array.isArray(content.tests) ? content.tests : [];
  const runner = createRunner(language);

  const editor = el("textarea");
  editor.rows = 16;
  editor.className = "code-editor";
  editor.spellcheck = false;
  editor.value = content.starter || "";

  const runButton = el("button", "実行");
  const judgeButton = el("button", "ジャッジ");
  const status = el("p", "実行環境を準備中…");
  const result = el("p");
  const output = el("pre");

  function setBusy(busy) {
    runButton.disabled = busy;
    judgeButton.disabled = busy;
  }

  setBusy(true);
  runner.whenReady().then(() => {
    setBusy(false);
    status.textContent = "準備できました!";
  });

  runButton.addEventListener("click", async () => {
    setBusy(true);
    result.textContent = "";
    output.textContent = "";

    const r = await runner.run(editor.value, "");
    let text = r.lines.join("\n");
    if (r.timedOut) text += "\n時間切れです(" + TIME_LIMIT_MS / 1000 + "秒)。";
    output.textContent = text.slice(0, 10000);
    setBusy(false);
  });

  judgeButton.addEventListener("click", async () => {
    setBusy(true);
    output.textContent = "";
    result.textContent = "ジャッジ中…";

    const g = await gradeCodeWithRules(runner, editor.value, tests, content.requirements || []);
    output.textContent = g.messages.join("\n").slice(0, 10000);
    result.textContent = g.allPassed ? "✅ 全部正解!" : "❌ " + g.passed + " / " + g.total + " 正解";
    setBusy(false);

    if (g.allPassed) markDone();
  });

  bodyEl.append(
    el("p", content.statement || ""),
    el("h3", "Pythonエディタ"),
    editor, el("div").append(runButton, judgeButton),
    status, result, el("h3", "実行結果"), output
  );
}

// ---------- ステージを読み込んで表示 ----------
async function loadStage() {
  if (!Number.isInteger(stageId) || stageId <= 0) {
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
    bodyEl.textContent = "ステージを読み込めませんでした";
    return;
  }

  currentStage = data;
  titleEl.textContent = data.quests.title + " / " + data.title;
  bodyEl.textContent = "";

  if (data.kind === "study") renderStudy(data.content);
  else if (data.kind === "fill") renderFill(data.content);
  else if (data.kind === "problem") renderProblem(data.content, data.quests.language);
}

loadStage();