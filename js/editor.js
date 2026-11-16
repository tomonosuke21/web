const notice = document.getElementById("editor-notice");
const editorMain = document.getElementById("editor-main");
const adminMain = document.getElementById("admin-main");
const myQuests = document.getElementById("my-quests");
const pendingQuests = document.getElementById("pending-quests");

const qTitle = document.getElementById("q-title");
const qDescription = document.getElementById("q-description");
const qLanguage = document.getElementById("q-language");
const qDifficulty = document.getElementById("q-difficulty");
const qMinutes = document.getElementById("q-minutes");
const qCreate = document.getElementById("q-create");
const qMessage = document.getElementById("q-message");

const stageEditor = document.getElementById("stage-editor");
const stageEditorTitle = document.getElementById("stage-editor-title");
const stageEditorList = document.getElementById("stage-editor-list");
const sKind = document.getElementById("s-kind");
const sTitle = document.getElementById("s-title");
const sFields = document.getElementById("s-fields");
const sAdd = document.getElementById("s-add");
const sMessage = document.getElementById("s-message");

const STATUS_LABELS = { draft: "下書き", pending: "申請中", published: "公開済み" };
const KIND_LABELS = { study: "スタディ", fill: "穴埋めテスト", problem: "練習問題" };

let selectedQuest = null;
let currentStages = [];
let fields = {};
let authorRunner = null;

function makeButton(label, onClick) {
  const button = el("button", label);
  button.addEventListener("click", onClick);
  return button;
}

function labeled(labelText, node) {
  const wrap = el("div");
  wrap.append(el("label", labelText), node);
  return wrap;
}

function makeTextarea(rows) {
  const t = el("textarea");
  t.rows = rows;
  t.style.width = "100%";
  return t;
}

// トイプロ風エディタコンポーネントを生成（問題作成画面用）
function createIdeEditorComponent(initialCode, onRunClick, extraToolbarButtons = []) {
  const box = el("div");
  box.className = "ide-editor-box";
  box.style.marginTop = "8px";

  const toolbar = el("div");
  toolbar.className = "ide-toolbar";

  const tbLeft = el("div");
  tbLeft.className = "ide-toolbar-left";

  const runBtn = el("button");
  runBtn.type = "button";
  runBtn.className = "ide-btn ide-btn-run";
  const icon = el("span", "▶");
  icon.className = "icon";
  runBtn.append(icon, " テスト実行");
  runBtn.addEventListener("click", onRunClick);
  tbLeft.append(runBtn, ...extraToolbarButtons);

  const tbRight = el("div");
  tbRight.className = "ide-toolbar-right";
  const statusBadge = el("span", "Python実行環境");
  statusBadge.className = "ide-status-badge";
  tbRight.append(statusBadge);

  toolbar.append(tbLeft, tbRight);

  const wrap = el("div");
  wrap.className = "ide-textarea-wrap";
  const gutter = el("div", "1");
  gutter.className = "ide-gutter";
  const textarea = el("textarea");
  textarea.className = "ide-code-input";
  textarea.spellcheck = false;
  textarea.value = initialCode || "";

  attachLineNumbers(textarea, gutter);
  wrap.append(gutter, textarea);
  box.append(toolbar, wrap);

  return { box, textarea, runBtn, statusBadge };
}

// ---------- ログイン状態に合わせて表示を切り替える ----------
function onAuthReady() {
  const role = currentProfile ? currentProfile.role : null;
  const canAuthor = role === "author" || role === "admin";

  editorMain.hidden = !canAuthor;
  adminMain.hidden = role !== "admin";

  if (currentUser === null) {
    notice.textContent = "ログインしてください";
  } else if (!canAuthor) {
    notice.textContent = "問題を作るには「作者」の権限が必要です。管理者に権限を付けてもらってください。";
  } else {
    notice.textContent = "";
  }

  if (canAuthor) loadMyQuests();
  if (role === "admin") loadPendingQuests();
}

// ---------- クエストを作る ----------
qCreate.addEventListener("click", async () => {
  const title = qTitle.value.trim();
  if (title === "") {
    qMessage.textContent = "タイトルを入力してください";
    return;
  }

  qCreate.disabled = true;
  const { data, error } = await db
    .from("quests")
    .insert({
      title: title,
      description: qDescription.value.trim(),
      language: qLanguage.value,
      difficulty: Number(qDifficulty.value),
      minutes: Number(qMinutes.value),
    })
    .select("id, title, status")
    .single();
  qCreate.disabled = false;

  if (error) {
    console.error(error);
    qMessage.textContent = "作成に失敗しました";
    return;
  }

  qMessage.textContent = "作成しました。下でステージを追加してください";
  qTitle.value = "";
  qDescription.value = "";
  await loadMyQuests();
  selectQuest(data);
});

// ---------- 自分のクエスト一覧 ----------
async function loadMyQuests() {
  const { data, error } = await db
    .from("quests")
    .select("id, title, status")
    .eq("author_id", currentUser.id)
    .order("id", { ascending: false });

  myQuests.textContent = "";
  if (error) {
    console.error(error);
    myQuests.textContent = "読み込めませんでした";
    return;
  }
  if (data.length === 0) {
    myQuests.textContent = "まだクエストがありません";
    return;
  }

  const list = el("ul");
  for (const quest of data) list.appendChild(createMyQuestItem(quest));
  myQuests.appendChild(list);
}

function createMyQuestItem(quest) {
  const item = el("li", quest.title + " (" + STATUS_LABELS[quest.status] + ") ");

  if (quest.status !== "published") {
    item.appendChild(makeButton("ステージを編集", () => selectQuest(quest)));
  }
  if (quest.status === "draft") {
    item.appendChild(makeButton("申請する", () => submitQuest(quest)));
    const delBtn = makeButton("削除", () => deleteQuest(quest));
    delBtn.className = "secondary";
    item.appendChild(delBtn);
  }
  if (quest.status === "pending") {
    const backBtn = makeButton("下書きに戻す", () => changeStatus(quest, "draft"));
    backBtn.className = "secondary";
    item.appendChild(backBtn);
  }
  return item;
}

async function submitQuest(quest) {
  const { count, error } = await db
    .from("stages")
    .select("id", { count: "exact", head: true })
    .eq("quest_id", quest.id);

  if (error) {
    console.error(error);
    alert("確認に失敗しました");
    return;
  }
  if (count === 0) {
    alert("ステージが1つもありません。先にステージを追加してください。");
    return;
  }
  await changeStatus(quest, "pending");
}

async function changeStatus(quest, status) {
  const { data, error } = await db
    .from("quests")
    .update({ status: status })
    .eq("id", quest.id)
    .select("id");

  if (error || !data || data.length === 0) {
    console.error(error);
    alert("変更に失敗しました");
    return;
  }
  onAuthReady();
}

async function deleteQuest(quest) {
  if (!window.confirm("「" + quest.title + "」を削除します。よろしいですか?")) return;

  const { data, error } = await db.from("quests").delete().eq("id", quest.id).select("id");
  if (error || !data || data.length === 0) {
    console.error(error);
    alert("削除に失敗しました");
    return;
  }
  if (selectedQuest !== null && selectedQuest.id === quest.id) {
    selectedQuest = null;
    stageEditor.hidden = true;
  }
  onAuthReady();
}

// ---------- ステージの編集 ----------
function selectQuest(quest) {
  selectedQuest = quest;
  stageEditor.hidden = false;
  stageEditorTitle.textContent = "ステージの編集: " + quest.title;
  sMessage.textContent = "";
  buildFields(sKind.value);
  loadStages();
}

async function loadStages() {
  const { data, error } = await db
    .from("stages")
    .select("id, position, kind, title")
    .eq("quest_id", selectedQuest.id)
    .order("position");

  stageEditorList.textContent = "";
  if (error) {
    console.error(error);
    stageEditorList.textContent = "読み込めませんでした";
    return;
  }

  currentStages = data;
  for (const stage of data) {
    const item = el("li", KIND_LABELS[stage.kind] + ": " + stage.title + " ");
    const link = el("a", "試す");
    link.href = "stage.html?id=" + stage.id;
    link.target = "_blank";
    link.rel = "noopener";
    const delBtn = makeButton("削除", () => deleteStage(stage));
    delBtn.className = "secondary";
    item.append(link, " ", delBtn);
    stageEditorList.appendChild(item);
  }
}

async function deleteStage(stage) {
  if (!window.confirm("このステージを削除します。よろしいですか?")) return;

  const { data, error } = await db.from("stages").delete().eq("id", stage.id).select("id");
  if (error || !data || data.length === 0) {
    console.error(error);
    alert("削除に失敗しました");
    return;
  }
  loadStages();
}

// 種類ごとの入力欄を作る
function buildFields(kind) {
  sFields.textContent = "";
  fields = {};

  if (kind === "study") {
    fields.slideRows = [];
    const box = el("div");
    const addSlideRow = () => {
      const title = el("input");
      title.type = "text";
      title.maxLength = 100;
      title.style.width = "100%";
      const text = makeTextarea(3);

      const sandboxOut = el("pre", "(ここに実行結果が表示されます)");
      sandboxOut.className = "editor-sandbox-output";

      const ideComp = createIdeEditorComponent("# コード例(なくてもOK)\n", async () => {
        ideComp.runBtn.disabled = true;
        sandboxOut.textContent = "実行中…";
        try {
          if (!authorRunner) authorRunner = createRunner("python");
          await authorRunner.whenReady();
          const r = await authorRunner.run(ideComp.textarea.value, "");
          let out = r.lines.join("\n");
          if (r.timedOut) out += "\n時間切れです";
          sandboxOut.textContent = out || "(出力なし)";
        } catch (e) {
          sandboxOut.textContent = "エラー: " + e.message;
        }
        ideComp.runBtn.disabled = false;
      });
      ideComp.textarea.style.minHeight = "140px";

      const row = el("div");
      row.className = "card";
      row.append(
        el("h4", "スライド " + (fields.slideRows.length + 1)),
        labeled("スライドのタイトル", title),
        labeled("説明", text),
        el("label", "コード例(実行環境で動作確認できます)"),
        ideComp.box,
        el("label", "実行結果プレビュー"),
        sandboxOut
      );
      box.appendChild(row);
      fields.slideRows.push({ title: title, text: text, code: ideComp.textarea });
    };
    addSlideRow();
    sFields.append(box, makeButton("スライドを追加", addSlideRow));
  } else if (kind === "fill") {
    fields.statement = makeTextarea(2);
    fields.template = makeTextarea(4);
    fields.answers = makeTextarea(3);
    sFields.append(
      labeled("問題文", fields.statement),
      labeled("コード(空欄は ___ とアンダーバー3つで書く)", fields.template),
      labeled("答え(空欄の順に、1行に1つ)", fields.answers)
    );
  } else if (kind === "problem") {
    fields.statement = makeTextarea(3);
    fields.starter = makeTextarea(4);
    fields.testRows = [];
    fields.requirements = [];
    const testBox = el("div");
    const criteriaBox = el("div");
    const analysisStatus = el("p", "正解例を入力して、ツールバーの「テスト実行」または下のボタンで検証できます。");

    // 任意入力での単発テスト用コンソール（トイプロ風）
    const sandboxPanel = el("div");
    sandboxPanel.className = "editor-sandbox-panel";
    const sandboxHeader = el("div", "実行結果コンソール (単発テスト実行)");
    sandboxHeader.className = "editor-sandbox-header";
    const sandboxBody = el("div");
    sandboxBody.className = "editor-sandbox-body";

    const sandboxInput = el("textarea");
    sandboxInput.rows = 3;
    sandboxInput.placeholder = "標準入力 (input() で読み込む値があれば入力)";
    const sandboxOutput = el("pre", "(「▶ テスト実行」を押すとここに結果が出ます)");
    sandboxOutput.className = "editor-sandbox-output";

    const inWrap = el("div");
    inWrap.append(el("div", "標準入力 (任意)"), sandboxInput);
    const outWrap = el("div");
    outWrap.append(el("div", "標準出力"), sandboxOutput);
    sandboxBody.append(inWrap, outWrap);
    sandboxPanel.append(sandboxHeader, sandboxBody);

    // ツールバーの「テスト実行」ハンドラ
    const runSingleTest = async () => {
      ideComp.runBtn.disabled = true;
      sandboxOutput.textContent = "実行中…";
      try {
        if (!authorRunner) authorRunner = createRunner("python");
        await authorRunner.whenReady();
        const r = await authorRunner.run(fields.solution.value, sandboxInput.value);
        let out = r.lines.join("\n");
        if (r.timedOut) out += "\n時間切れです";
        sandboxOutput.textContent = out || "(出力なし)";
      } catch (e) {
        sandboxOutput.textContent = "実行エラー: " + e.message;
      }
      ideComp.runBtn.disabled = false;
    };

    // ツールバーの「全テストケース生成」ボタン
    const batchGenBtn = el("button");
    batchGenBtn.type = "button";
    batchGenBtn.className = "ide-btn ide-btn-judge";
    const bIcon = el("span", "✓");
    bIcon.className = "icon";
    batchGenBtn.append(bIcon, " 全テストケースの正解出力を生成");

    const ideComp = createIdeEditorComponent("# 正解例のPythonコードを入力\n", runSingleTest, [batchGenBtn]);
    fields.solution = ideComp.textarea;

    const generateAllTests = async () => {
      batchGenBtn.disabled = true;
      previewButton.disabled = true;
      analysisStatus.textContent = "テストケース実行中…";
      try {
        if (!authorRunner) authorRunner = createRunner("python");
        await authorRunner.whenReady();
        for (const t of fields.testRows) {
          const r = await authorRunner.run(fields.solution.value, t.input.value);
          if (r.hasError || r.timedOut) throw new Error(r.lines.join("\n") || "実行時間切れ");
          t.output = r.lines.join("\n").trim();
          t.expected.textContent = t.output || "(出力なし)";
        }
        analysisStatus.textContent = "すべてのテストケースの正解出力を生成しました！";
      } catch (e) {
        analysisStatus.textContent = "実行できませんでした: " + e.message;
      }
      batchGenBtn.disabled = false;
      previewButton.disabled = false;
    };

    batchGenBtn.addEventListener("click", generateAllTests);

    const addTestRow = () => {
      const input = makeTextarea(2);
      const expected = el("p", "未生成");
      expected.className = "generated-output";
      const row = el("section");
      row.className = "test-case card";
      row.append(
        el("h4", "テストケース " + (fields.testRows.length + 1)),
        labeled("入力(input()で読み込む内容。なければ空)", input),
        el("span", "正解出力: "),
        expected
      );
      testBox.appendChild(row);
      fields.testRows.push({ input, expected, output: null });
    };

    const analyzeButton = makeButton("正解例を解析して条件候補を抽出", async () => {
      analyzeButton.disabled = true;
      analysisStatus.textContent = "解析中…";
      try {
        if (!authorRunner) authorRunner = createRunner("python");
        await authorRunner.whenReady();
        const candidates = await analyzePython(authorRunner, fields.solution.value);
        fields.candidates = candidates;
        fields.requirements = [];
        renderCriteria(criteriaBox, candidates);
        analysisStatus.textContent = candidates.length + "個の候補を抽出しました。必須にしたい項目にチェックしてください。";
      } catch (e) {
        analysisStatus.textContent = "解析できませんでした: " + e.message;
      }
      analyzeButton.disabled = false;
    });

    const previewButton = makeButton("正解例を実行してテスト出力を生成", generateAllTests);

    const addRuleType = el("select");
    for (const [v, label] of [["syntax","構文"],["call","関数・命令"],["variable","変数名"],["operator","演算子"]]) {
      const opt = el("option", label);
      opt.value = v;
      addRuleType.appendChild(opt);
    }
    const addRuleName = el("input");
    addRuleName.placeholder = "例: For / range / total / Add";
    const addRuleButton = makeButton("条件を追加", () => {
      const rule = { type: addRuleType.value, name: addRuleName.value.trim() };
      if (!rule.name) return;
      if (!fields.requirements.some(x => x.type === rule.type && x.name === rule.name)) fields.requirements.push(rule);
      const all = [...(fields.candidates || []), ...fields.requirements].filter((x, i, a) => a.findIndex(y => y.type === x.type && y.name === x.name) === i);
      renderCriteria(criteriaBox, all);
      addRuleName.value = "";
    });

    const btnBar = el("div");
    btnBar.className = "editor-test-bar";
    btnBar.append(previewButton, analyzeButton);

    const ruleAddBar = el("div");
    ruleAddBar.style.display = "flex";
    ruleAddBar.style.flexWrap = "wrap";
    ruleAddBar.style.gap = "8px";
    ruleAddBar.style.marginTop = "8px";
    ruleAddBar.append(addRuleType, addRuleName, addRuleButton);

    addTestRow();
    sFields.append(
      labeled("問題文", fields.statement),
      labeled("最初から書いておくコード(なくてもOK)", fields.starter),
      el("h3", "正解例のPythonコード（実行環境で動作確認できます）"),
      ideComp.box,
      sandboxPanel,
      el("p", "※ 正解例は作者用です。学習者には表示されません。"),
      btnBar,
      analysisStatus,
      el("h3", "テストケース"),
      testBox,
      makeButton("テストケースを追加", addTestRow),
      el("h3", "構文・内容の必須条件"),
      el("p", "自動抽出した候補からチェックするか、独自条件を追加できます。"),
      criteriaBox,
      ruleAddBar
    );
  }
}

function renderCriteria(container, candidates) {
  container.textContent = "";
  if (!candidates.length) { container.textContent = "候補はありません。必要なら条件を手動追加してください。"; return; }
  candidates.forEach(rule => {
    const label = el("label"); label.className = "criteria-item";
    const check = el("input"); check.type = "checkbox";
    check.checked = fields.requirements.some(x => x.type === rule.type && x.name === rule.name);
    check.addEventListener("change", () => {
      if (check.checked) {
        if (!fields.requirements.some(x => x.type === rule.type && x.name === rule.name)) fields.requirements.push(rule);
      } else fields.requirements = fields.requirements.filter(x => !(x.type === rule.type && x.name === rule.name));
    });
    label.append(check, " ", rule.type + ": " + rule.name); container.appendChild(label);
  });
}

function buildContent(kind) {
  if (kind === "study") {
    const slides = fields.slideRows
      .map((r) => ({
        title: r.title.value.trim(),
        text: r.text.value.trim(),
        code: r.code.value.trim(),
      }))
      .filter((s) => s.title !== "" || s.text !== "" || s.code !== "");

    if (slides.length === 0) throw new Error("スライドを1つ以上書いてください");
    if (slides.some((s) => s.title === "" || s.text === "")) {
      throw new Error("スライドのタイトルと説明は必須です");
    }
    return { slides: slides };
  }

  const statement = fields.statement.value.trim();
  if (statement === "") throw new Error("問題文を入力してください");

  if (kind === "fill") {
    const template = fields.template.value.trimEnd();
    const blanks = fields.answers.value.split("\n").map((s) => s.trim()).filter((s) => s !== "");
    const blankCount = template.split("___").length - 1;

    if (blankCount === 0) throw new Error("コードに ___ の空欄がありません");
    if (blanks.length !== blankCount) {
      throw new Error("空欄は" + blankCount + "個ですが、答えは" + blanks.length + "個です");
    }
    return { statement: statement, template: template, blanks: blanks };
  }

  const tests = fields.testRows.map(r => ({ input: r.input.value.trimEnd(), expected: r.output }));
  if (!fields.solution.value.trim()) throw new Error("正解例のPythonコードを入力してください");
  if (tests.length === 0 || tests.some(t => t.expected === null)) throw new Error("先に正解例を実行して、すべてのテスト出力を生成してください");
  return { statement, starter: fields.starter.value, solutionCode: fields.solution.value,
    tests, requirements: fields.requirements || [] };
}

sKind.addEventListener("change", () => buildFields(sKind.value));

sAdd.addEventListener("click", async () => {
  if (selectedQuest === null) return;

  const title = sTitle.value.trim();
  const kind = sKind.value;
  let content = null;

  try {
    if (title === "") throw new Error("ステージのタイトルを入力してください");
    content = buildContent(kind);
  } catch (e) {
    sMessage.textContent = e.message;
    return;
  }

  const position =
    currentStages.length === 0 ? 1 : Math.max(...currentStages.map((s) => s.position)) + 1;

  sAdd.disabled = true;
  const { error } = await db.from("stages").insert({
    quest_id: selectedQuest.id,
    position: position,
    kind: kind,
    title: title,
    content: content,
  });
  sAdd.disabled = false;

  if (error) {
    console.error(error);
    sMessage.textContent = "追加に失敗しました";
    return;
  }

  sMessage.textContent = "追加しました";
  sTitle.value = "";
  buildFields(kind);
  loadStages();
});

// ---------- 管理者: 承認待ちの一覧 ----------
async function loadPendingQuests() {
  const { data, error } = await db
    .from("quests")
    .select("id, title, description, author_id")
    .eq("status", "pending")
    .order("id");

  pendingQuests.textContent = "";
  if (error) {
    console.error(error);
    pendingQuests.textContent = "読み込めませんでした";
    return;
  }
  if (data.length === 0) {
    pendingQuests.textContent = "承認待ちはありません";
    return;
  }

  const authorIds = [...new Set(data.map((q) => q.author_id).filter((id) => id !== null))];
  const questIds = data.map((q) => q.id);
  const profilesResult = await db.from("profiles").select("id, nickname").in("id", authorIds);
  const stagesResult = await db
    .from("stages")
    .select("id, quest_id, position, kind, title")
    .in("quest_id", questIds)
    .order("position");

  const nicknames = new Map((profilesResult.data || []).map((p) => [p.id, p.nickname]));
  const stages = stagesResult.data || [];

  for (const quest of data) {
    const box = el("section");
    box.className = "card";
    box.append(
      el("h3", quest.title),
      el("p", "作者: " + (nicknames.get(quest.author_id) || "不明")),
      el("p", quest.description)
    );

    const list = el("ol");
    for (const stage of stages.filter((s) => s.quest_id === quest.id)) {
      const item = el("li", KIND_LABELS[stage.kind] + ": " + stage.title + " ");
      const link = el("a", "確認する");
      link.href = "stage.html?id=" + stage.id;
      link.target = "_blank";
      link.rel = "noopener";
      item.appendChild(link);
      list.appendChild(item);
    }

    const actRow = el("div");
    actRow.style.display = "flex";
    actRow.style.gap = "8px";
    const pubBtn = makeButton("承認して公開", () => changeStatus(quest, "published"));
    pubBtn.className = "success";
    const retBtn = makeButton("差し戻し", () => changeStatus(quest, "draft"));
    retBtn.className = "secondary";
    actRow.append(pubBtn, retBtn);

    box.append(list, actRow);
    pendingQuests.appendChild(box);
  }
}
