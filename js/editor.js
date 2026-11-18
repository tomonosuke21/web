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
const stageListPanel = document.getElementById("stage-list-panel");
const stageEditorList = document.getElementById("stage-editor-list");
const sKind = document.getElementById("s-kind");
const sTitle = document.getElementById("s-title");
const sFields = document.getElementById("s-fields");
const sAdd = document.getElementById("s-add");
const sMessage = document.getElementById("s-message");

const STATUS_LABELS = { draft: "下書き", pending: "申請中", published: "公開済み" };
const KIND_LABELS = { study: "スタディ", fill: "穴埋め", problem: "練習問題" };

let selectedQuest = null;
let currentStages = [];
let fields = {};
let authorRunner = null;

function makeButton(label, onClick) {
  const button = el("button", label);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function labeled(labelText, node) {
  const wrap = el("div");
  wrap.append(el("label", labelText), node);
  return wrap;
}

function makeTextarea(rows, placeholder = "") {
  const t = el("textarea");
  t.rows = rows;
  t.style.width = "100%";
  if (placeholder) t.placeholder = placeholder;
  return t;
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
    notice.textContent = "問題を作るには「作者」の権限が必要です。管理者に権限をもらってください。";
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

  qMessage.textContent = "作成しました。上のワークスペースでステージを追加できます";
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
    myQuests.textContent = "まだ問題がありません。上のフォームから作成してください。";
    return;
  }

  const list = el("ul");
  list.className = "styled-list";
  for (const quest of data) list.appendChild(createMyQuestItem(quest));
  myQuests.appendChild(list);

  // 未選択なら最新の未公開クエストを自動的に選択状態にしてすぐ作問できるようにする
  if (!selectedQuest) {
    const editable = data.find((q) => q.status !== "published");
    if (editable) selectQuest(editable);
  }
}

function createMyQuestItem(quest) {
  const item = el("li");
  item.className = "quest-manage-item";

  const info = el("span", quest.title + " ");
  info.className = "quest-manage-title";
  const badge = el("span", STATUS_LABELS[quest.status]);
  badge.className = "status-pill status-" + quest.status;
  info.appendChild(badge);

  const actions = el("div");
  actions.className = "quest-manage-actions";

  if (quest.status !== "published") {
    actions.appendChild(makeButton("ステージを編集", () => {
      selectQuest(quest);
      stageEditor.scrollIntoView({ behavior: "smooth" });
    }));
  }
  if (quest.status === "draft") {
    const subBtn = makeButton("申請する", () => submitQuest(quest));
    subBtn.className = "success";
    actions.appendChild(subBtn);
    const delBtn = makeButton("削除", () => deleteQuest(quest));
    delBtn.className = "secondary";
    actions.appendChild(delBtn);
  }
  if (quest.status === "pending") {
    const backBtn = makeButton("下書きに戻す", () => changeStatus(quest, "draft"));
    backBtn.className = "secondary";
    actions.appendChild(backBtn);
  }

  item.append(info, actions);
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
    stageListPanel.hidden = true;
  }
  onAuthReady();
}

// ---------- ステージの編集 ----------
function selectQuest(quest) {
  selectedQuest = quest;
  stageEditor.hidden = false;
  stageListPanel.hidden = false;
  stageEditorTitle.textContent = quest.title;
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
  if (data.length === 0) {
    const empty = el("li", "まだステージがありません");
    empty.style.color = "var(--text-secondary)";
    stageEditorList.appendChild(empty);
    return;
  }

  for (const stage of data) {
    const item = el("li");
    item.className = "quest-manage-item";
    const info = el("span", KIND_LABELS[stage.kind] + " : " + stage.title);
    const actions = el("div");
    actions.className = "quest-manage-actions";
    const link = el("a", "プレビュー");
    link.href = "stage.html?id=" + stage.id;
    link.target = "_blank";
    link.rel = "noopener";
    const delBtn = makeButton("削除", () => deleteStage(stage));
    delBtn.className = "secondary";
    actions.append(link, delBtn);
    item.append(info, actions);
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

// ---------- 種類ごとの入力欄（練習問題は解答画面と同じ2ペイン構成） ----------
function buildFields(kind) {
  sFields.textContent = "";
  fields = {};

  if (kind === "problem") {
    fields.testRows = [];
    fields.requirements = [];
    fields.candidates = [];

    // ====================================================
    // 1. 上部：問題を解く画面(stage.html)と同一の左右2ペイン構成
    // ====================================================
    const workspace = el("div");
    workspace.className = "ide-workspace";

    // --- 左ペイン：問題文編集＆プレビュー（出力例は非表示） ---
    const leftPane = el("section");
    leftPane.className = "ide-left-pane";

    // フローティング実行結果ウィンドウ（stage.htmlと同じ構造）
    const floatingConsole = el("div");
    floatingConsole.className = "floating-console";
    floatingConsole.hidden = true;

    const consoleHeader = el("div");
    consoleHeader.className = "floating-console-header";
    const closeConsoleBtn = el("button", "閉じる");
    closeConsoleBtn.type = "button";
    closeConsoleBtn.className = "floating-console-close";
    closeConsoleBtn.addEventListener("click", () => {
      floatingConsole.hidden = true;
    });
    consoleHeader.append(el("span", "テスト実行結果"), closeConsoleBtn);

    const consoleOutput = el("pre");
    consoleOutput.className = "floating-console-body";
    floatingConsole.append(consoleHeader, consoleOutput);

    const probHeader = el("div");
    probHeader.className = "problem-header";
    const previewTitle = el("h2", sTitle.value.trim() || "練習問題（タイトル未入力）");
    probHeader.append(previewTitle);

    sTitle.oninput = () => {
      previewTitle.textContent = sTitle.value.trim() || "練習問題（タイトル未入力）";
    };

    const stmtLabel = el("label", "問題文（学習者に表示されます）");
    stmtLabel.style.marginTop = "0";
    fields.statement = makeTextarea(10, "例: 2つの整数が1行ずつ入力されます。合計を出力してください。");
    fields.statement.className = "editor-statement-input";

    // 入力例のみ表示（出力例は非表示）
    const inputPreviewBox = el("div");
    inputPreviewBox.className = "example-box";
    const inputPreviewCode = el("pre", "(テストケース1の入力がここに反映されます)");
    inputPreviewCode.className = "example-code";
    inputPreviewBox.append(el("h4", "入力例（テストケース1）"), inputPreviewCode);

    leftPane.append(floatingConsole, probHeader, stmtLabel, fields.statement, inputPreviewBox);

    // --- 右ペイン：ダークコードエディタ ＋ テストケース入力テーブル ---
    const rightPane = el("section");
    rightPane.className = "ide-right-pane";

    const editorBox = el("div");
    editorBox.className = "ide-editor-box";

    const toolbar = el("div");
    toolbar.className = "ide-toolbar";

    const tbLeft = el("div");
    tbLeft.className = "ide-toolbar-left";

    const runBtn = el("button", "実行テスト");
    runBtn.type = "button";
    runBtn.className = "ide-btn ide-btn-run";

    const verifyAllBtn = el("button", "全ケース検証");
    verifyAllBtn.type = "button";
    verifyAllBtn.className = "ide-btn ide-btn-judge";

    tbLeft.append(runBtn, verifyAllBtn);

    const tbRight = el("div");
    tbRight.className = "ide-toolbar-right";
    const statusBadge = el("span", "正解例コード（非公開）");
    statusBadge.className = "ide-status-badge";
    tbRight.append(statusBadge);

    toolbar.append(tbLeft, tbRight);

    const textareaWrap = el("div");
    textareaWrap.className = "ide-textarea-wrap";
    const gutter = el("div", "1");
    gutter.className = "ide-gutter";
    const solutionEditor = el("textarea");
    solutionEditor.className = "ide-code-input";
    solutionEditor.spellcheck = false;
    solutionEditor.value = "# 正解例のPythonコードを入力\n";
    fields.solution = solutionEditor;

    attachLineNumbers(solutionEditor, gutter);
    textareaWrap.append(gutter, solutionEditor);
    editorBox.append(toolbar, textareaWrap);
    rightPane.appendChild(editorBox);

    // テストケーステーブル（出力例は画面に表示せず、入力のみ設定・状態バッジ表示）
    const tcPanel = el("div");
    tcPanel.className = "testcase-panel";
    const tcHeaderRow = el("div");
    tcHeaderRow.className = "testcase-panel-header";
    tcHeaderRow.append(el("h4", "テストケース（入力値）"));

    const addCaseBtn = makeButton("+ ケース追加", () => addTestRow());
    addCaseBtn.className = "secondary";
    addCaseBtn.style.padding = "5px 12px";
    addCaseBtn.style.fontSize = "0.82rem";
    tcHeaderRow.appendChild(addCaseBtn);

    const table = el("table");
    table.className = "testcase-table";
    const thead = el("thead");
    const headTr = el("tr");
    const thNo = el("th", "No");
    thNo.style.width = "46px";
    const thStatus = el("th", "検証状態");
    thStatus.style.width = "96px";
    headTr.append(thNo, el("th", "入力 (input() で読み込む値 / なければ空)"), thStatus);
    thead.appendChild(headTr);

    const tbody = el("tbody");
    table.append(thead, tbody);
    tcPanel.append(tcHeaderRow, table);
    rightPane.appendChild(tcPanel);

    workspace.append(leftPane, rightPane);

    // ====================================================
    // 2. 下部：その下にこれまでの構成要素（初期コード・必須構文条件）を配置
    // ====================================================
    const lowerConfigCard = el("div");
    lowerConfigCard.className = "center-card editor-subconfig-card";

    const analysisStatus = el("p", "正解例コードを入力し、「全ケース検証」でテストケースの動作確認ができます（出力例は表示されません）。");
    analysisStatus.className = "section-caption";

    const criteriaBox = el("div");

    const addTestRow = () => {
      const idx = fields.testRows.length;
      const tr = el("tr");
      const tdNo = el("td", String(idx + 1));

      const tdIn = el("td");
      const inputArea = el("textarea");
      inputArea.rows = 2;
      inputArea.style.width = "100%";
      inputArea.placeholder = "例: 3\n5";
      tdIn.appendChild(inputArea);

      // 出力例そのものは表示せず、検証済みかどうかだけ内部保持＋状態ラベル表示
      const tdState = el("td");
      const stateBadge = el("span", "未検証");
      stateBadge.className = "tc-state-badge pending";
      tdState.appendChild(stateBadge);

      const rowObj = { input: inputArea, stateBadge, output: null };

      inputArea.addEventListener("input", () => {
        rowObj.output = null;
        stateBadge.textContent = "未検証";
        stateBadge.className = "tc-state-badge pending";
        if (idx === 0) {
          inputPreviewCode.textContent = inputArea.value || "(入力なし)";
        }
      });

      tr.append(tdNo, tdIn, tdState);
      tbody.appendChild(tr);
      fields.testRows.push(rowObj);
    };

    solutionEditor.addEventListener("input", () => {
      for (const t of fields.testRows) {
        t.output = null;
        t.stateBadge.textContent = "未検証";
        t.stateBadge.className = "tc-state-badge pending";
      }
    });

    // 単発実行テスト（テストケース1の入力を使ってフローティングコンソールに表示）
    runBtn.addEventListener("click", async () => {
      runBtn.disabled = true;
      verifyAllBtn.disabled = true;
      floatingConsole.hidden = false;
      consoleOutput.textContent = "実行中…";
      try {
        if (!authorRunner) authorRunner = createRunner("python");
        await authorRunner.whenReady();
        const firstIn = fields.testRows.length > 0 ? fields.testRows[0].input.value : "";
        const r = await authorRunner.run(solutionEditor.value, firstIn);
        let out = r.lines.join("\n");
        if (r.timedOut) out += "\n時間切れです";
        consoleOutput.textContent = out || "(出力なし)";
      } catch (e) {
        consoleOutput.textContent = "エラー: " + e.message;
      }
      runBtn.disabled = false;
      verifyAllBtn.disabled = false;
    });

    // 全テストケース検証（出力例はUIには出さず内部の expected として確定）
    const verifyAllCases = async () => {
      verifyAllBtn.disabled = true;
      runBtn.disabled = true;
      analysisStatus.textContent = "全テストケースを実行・検証中…";
      try {
        if (!authorRunner) authorRunner = createRunner("python");
        await authorRunner.whenReady();
        for (const t of fields.testRows) {
          const r = await authorRunner.run(solutionEditor.value, t.input.value);
          if (r.hasError || r.timedOut) {
            t.output = null;
            t.stateBadge.textContent = "エラー";
            t.stateBadge.className = "tc-state-badge error";
            throw new Error(r.lines.join("\n") || "実行時間切れ");
          }
          t.output = r.lines.join("\n").trim();
          t.stateBadge.textContent = "検証OK";
          t.stateBadge.className = "tc-state-badge ok";
        }
        analysisStatus.textContent = "すべてのテストケースの検証が完了しました。";
      } catch (e) {
        analysisStatus.textContent = "検証エラー: " + e.message;
      }
      verifyAllBtn.disabled = false;
      runBtn.disabled = false;
    };

    verifyAllBtn.addEventListener("click", verifyAllCases);

    // 初期コード欄
    fields.starter = makeTextarea(4, "# 学習者のエディタに最初から表示しておくコード（任意）");

    // 構文・内容の必須条件抽出
    const analyzeButton = makeButton("正解例を解析して必須条件候補を抽出", async () => {
      analyzeButton.disabled = true;
      analysisStatus.textContent = "コードを解析中…";
      try {
        if (!authorRunner) authorRunner = createRunner("python");
        await authorRunner.whenReady();
        const candidates = await analyzePython(authorRunner, solutionEditor.value);
        fields.candidates = candidates;
        fields.requirements = [];
        renderCriteria(criteriaBox, candidates);
        analysisStatus.textContent = candidates.length + "個の候補を抽出しました。必須にしたい項目にチェックしてください。";
      } catch (e) {
        analysisStatus.textContent = "解析できませんでした: " + e.message;
      }
      analyzeButton.disabled = false;
    });

    const addRuleType = el("select");
    for (const [v, label] of [["syntax", "構文"], ["call", "関数・命令"], ["variable", "変数名"], ["operator", "演算子"]]) {
      const opt = el("option", label);
      opt.value = v;
      addRuleType.appendChild(opt);
    }
    const addRuleName = el("input");
    addRuleName.placeholder = "例: For / range / total / Add";
    const addRuleButton = makeButton("条件を追加", () => {
      const rule = { type: addRuleType.value, name: addRuleName.value.trim() };
      if (!rule.name) return;
      if (!fields.requirements.some((x) => x.type === rule.type && x.name === rule.name)) {
        fields.requirements.push(rule);
      }
      const all = [...(fields.candidates || []), ...fields.requirements].filter(
        (x, i, a) => a.findIndex((y) => y.type === x.type && y.name === x.name) === i
      );
      renderCriteria(criteriaBox, all);
      addRuleName.value = "";
    });

    const ruleAddBar = el("div");
    ruleAddBar.className = "flex-row mt";
    ruleAddBar.append(addRuleType, addRuleName, addRuleButton);

    const analyzeWrap = el("div");
    analyzeWrap.appendChild(analyzeButton);

    addTestRow();

    lowerConfigCard.append(
      el("h3", "追加オプション・必須条件設定"),
      analysisStatus,
      labeled("最初から書いておくコード（なくてもOK）", fields.starter),
      el("hr"),
      el("h4", "構文・内容の必須条件"),
      el("p", "正解例から自動抽出した候補にチェックを入れるか、独自条件を追加できます。"),
      analyzeWrap,
      criteriaBox,
      ruleAddBar
    );

    sFields.append(workspace, lowerConfigCard);
    return;
  }

  // ---------- スタディモード ----------
  if (kind === "study") {
    const card = el("div");
    card.className = "center-card";
    fields.slideRows = [];
    const box = el("div");

    const addSlideRow = () => {
      const title = el("input");
      title.type = "text";
      title.maxLength = 100;
      title.style.width = "100%";
      const text = makeTextarea(3);

      const codeArea = makeTextarea(5, "# コード例（任意）");
      codeArea.style.fontFamily = "var(--font-mono)";

      const row = el("section");
      row.className = "card";
      row.append(
        el("h4", "スライド " + (fields.slideRows.length + 1)),
        labeled("スライドのタイトル", title),
        labeled("説明", text),
        labeled("コード例（出力例は表示されません）", codeArea)
      );
      box.appendChild(row);
      fields.slideRows.push({ title: title, text: text, code: codeArea });
    };

    addSlideRow();
    card.append(box, makeButton("スライドを追加", addSlideRow));
    sFields.append(card);
    return;
  }

  // ---------- 穴埋めテストモード ----------
  if (kind === "fill") {
    const card = el("div");
    card.className = "center-card";
    fields.statement = makeTextarea(3);
    fields.template = makeTextarea(5);
    fields.answers = makeTextarea(3);
    card.append(
      labeled("問題文", fields.statement),
      labeled("コード(空欄は ___ とアンダーバー3つで書く)", fields.template),
      labeled("答え(空欄の順に、1行に1つ)", fields.answers)
    );
    sFields.append(card);
  }
}

function renderCriteria(container, candidates) {
  container.textContent = "";
  if (!candidates.length) {
    container.textContent = "候補はありません。必要なら条件を手動追加してください。";
    return;
  }
  candidates.forEach((rule) => {
    const label = el("label");
    label.className = "criteria-item";
    const check = el("input");
    check.type = "checkbox";
    check.checked = fields.requirements.some((x) => x.type === rule.type && x.name === rule.name);
    check.addEventListener("change", () => {
      if (check.checked) {
        if (!fields.requirements.some((x) => x.type === rule.type && x.name === rule.name)) {
          fields.requirements.push(rule);
        }
      } else {
        fields.requirements = fields.requirements.filter(
          (x) => !(x.type === rule.type && x.name === rule.name)
        );
      }
    });
    label.append(check, " ", rule.type + ": " + rule.name);
    container.appendChild(label);
  });
}

async function buildContent(kind) {
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
    const blanks = fields.answers.value
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    const blankCount = template.split("___").length - 1;

    if (blankCount === 0) throw new Error("コードに ___ の空欄がありません");
    if (blanks.length !== blankCount) {
      throw new Error("空欄は" + blankCount + "個ですが、答えは" + blanks.length + "個です");
    }
    return { statement: statement, template: template, blanks: blanks };
  }

  // 練習問題：未検証のテストケースがあれば保存時に自動で実行して期待値を確定する
  if (!fields.solution.value.trim()) throw new Error("正解例のPythonコードを入力してください");
  if (fields.testRows.length === 0) throw new Error("テストケースを1つ以上追加してください");

  if (fields.testRows.some((t) => t.output === null)) {
    if (!authorRunner) authorRunner = createRunner("python");
    await authorRunner.whenReady();
    for (const t of fields.testRows) {
      if (t.output === null) {
        const r = await authorRunner.run(fields.solution.value, t.input.value);
        if (r.hasError || r.timedOut) {
          throw new Error("正解例の実行エラー: " + (r.lines.join("\n") || "時間切れ"));
        }
        t.output = r.lines.join("\n").trim();
      }
    }
  }

  const tests = fields.testRows.map((r) => ({
    input: r.input.value.trimEnd(),
    expected: r.output,
  }));

  return {
    statement,
    starter: fields.starter.value,
    solutionCode: fields.solution.value,
    tests,
    requirements: fields.requirements || [],
  };
}

sKind.addEventListener("change", () => buildFields(sKind.value));

sAdd.addEventListener("click", async () => {
  if (selectedQuest === null) return;

  const title = sTitle.value.trim();
  const kind = sKind.value;
  let content = null;

  sAdd.disabled = true;
  try {
    if (title === "") throw new Error("ステージタイトルを入力してください");
    content = await buildContent(kind);
  } catch (e) {
    sMessage.textContent = e.message;
    sAdd.disabled = false;
    return;
  }

  const position =
    currentStages.length === 0 ? 1 : Math.max(...currentStages.map((s) => s.position)) + 1;

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

  sMessage.textContent = "ステージを追加しました";
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
