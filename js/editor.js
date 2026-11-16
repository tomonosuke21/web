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

let selectedQuest = null; // ステージを編集中のクエスト
let currentStages = [];   // そのクエストのステージ
let fields = {};          // 入力欄の部品
let authorRunner = null;

// ---------- 小さな補助 ----------
function makeButton(label, onClick) {
  const button = el("button", label);
  button.addEventListener("click", onClick);
  return button;
}

function labeled(labelText, node) {
  const wrap = el("div");
  wrap.append(el("label", labelText), el("br"), node);
  return wrap;
}

function makeTextarea(rows) {
  const t = el("textarea");
  t.rows = rows;
  t.cols = 60;
  return t;
}

// ---------- ログイン状態に合わせて表示を切り替える ----------
// (ログインとプロフィールの読み込みが終わると、auth.js から呼ばれる)
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
  const item = el("li", quest.title + "(" + STATUS_LABELS[quest.status] + ") ");

  if (quest.status !== "published") {
    item.appendChild(makeButton("ステージを編集", () => selectQuest(quest)));
  }
  if (quest.status === "draft") {
    item.appendChild(makeButton("申請する", () => submitQuest(quest)));
    item.appendChild(makeButton("削除", () => deleteQuest(quest)));
  }
  if (quest.status === "pending") {
    item.appendChild(makeButton("下書きに戻す", () => changeStatus(quest, "draft")));
  }
  return item;
}

// 申請する(ステージが1つ以上あるときだけ)
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

// 状態(下書き・申請中・公開済み)を変える
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
  onAuthReady(); // 一覧を読み込み直す
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
    item.append(link, " ", makeButton("削除", () => deleteStage(stage)));
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
      const text = makeTextarea(3);
      const code = makeTextarea(3);
      const row = el("div");
      row.append(
        el("hr"),
        labeled("スライドのタイトル", title),
        labeled("説明", text),
        labeled("コード例(なくてもOK)", code)
      );
      box.appendChild(row);
      fields.slideRows.push({ title: title, text: text, code: code });
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
    fields.solution = makeTextarea(12);
    fields.solution.className = "code-editor";
    fields.testRows = [];
    fields.requirements = [];
    const testBox = el("div");
    const criteriaBox = el("div");
    const analysisStatus = el("p", "正解例を入力すると、使用構文を自動抽出できます。");
    const addTestRow = () => {
      const input = makeTextarea(2);
      const expected = el("p", "未生成");
      expected.className = "generated-output";
      const row = el("section"); row.className = "test-case card";
      row.append(el("h4", "テストケース " + (fields.testRows.length + 1)),
        labeled("入力(input()で読み込む内容。なければ空)", input),
        el("span", "正解出力: "), expected);
      testBox.appendChild(row);
      fields.testRows.push({ input, expected, output: null });
    };
    const analyzeButton = makeButton("正解例を解析して条件候補を抽出", async () => {
      analyzeButton.disabled = true; analysisStatus.textContent = "解析中…";
      try {
        if (!authorRunner) authorRunner = createRunner("python");
        await authorRunner.whenReady();
        const candidates = await analyzePython(authorRunner, fields.solution.value);
        fields.candidates = candidates;
        fields.requirements = [];
        renderCriteria(criteriaBox, candidates);
        analysisStatus.textContent = candidates.length + "個の候補を抽出しました。必須にしたい項目にチェックしてください。";
      } catch (e) { analysisStatus.textContent = "解析できませんでした: " + e.message; }
      analyzeButton.disabled = false;
    });
    const previewButton = makeButton("正解例を実行してテスト出力を生成", async () => {
      previewButton.disabled = true; analysisStatus.textContent = "テスト実行中…";
      try {
        if (!authorRunner) authorRunner = createRunner("python");
        await authorRunner.whenReady();
        for (const t of fields.testRows) {
          const r = await authorRunner.run(fields.solution.value, t.input.value);
          if (r.hasError || r.timedOut) throw new Error(r.lines.join("\n") || "実行時間切れ");
          t.output = r.lines.join("\n").trim();
          t.expected.textContent = t.output || "(出力なし)";
        }
        analysisStatus.textContent = "正解出力を生成しました。内容を確認してステージを追加してください。";
      } catch (e) { analysisStatus.textContent = "実行できませんでした: " + e.message; }
      previewButton.disabled = false;
    });
    const addRuleType = el("select");
    for (const [v, label] of [["syntax","構文"],["call","関数・命令"],["variable","変数名"],["operator","演算子"]]) {
      const opt = el("option", label); opt.value = v; addRuleType.appendChild(opt);
    }
    const addRuleName = el("input"); addRuleName.placeholder = "例: For / range / total / Add";
    const addRuleButton = makeButton("条件を追加", () => {
      const rule = { type: addRuleType.value, name: addRuleName.value.trim() };
      if (!rule.name) return;
      if (!fields.requirements.some(x => x.type === rule.type && x.name === rule.name)) fields.requirements.push(rule);
      const all = [...(fields.candidates || []), ...fields.requirements].filter((x, i, a) => a.findIndex(y => y.type === x.type && y.name === x.name) === i);
      renderCriteria(criteriaBox, all); addRuleName.value = "";
    });
    addTestRow();
    sFields.append(
      labeled("問題文", fields.statement),
      labeled("最初から書いておくコード(なくてもOK)", fields.starter),
      el("h3", "正解例のPythonコード"), fields.solution,
      el("p", "正解例は作者用です。学習者には表示されません。"),
      el("div").appendChild(analyzeButton).parentNode,
      el("div").appendChild(previewButton).parentNode,
      analysisStatus,
      el("h3", "テストケース"), testBox, makeButton("テストケースを追加", addTestRow),
      el("h3", "構文・内容の必須条件"),
      el("p", "自動抽出した候補からチェックするか、独自条件を追加できます。"), criteriaBox,
      addRuleType, addRuleName, addRuleButton
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

// 入力欄から、ステージの中身(content)を作る。おかしければ Error を投げる
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

  // problem: 正解例を実行して生成した期待出力を保存する
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

  // 作者のニックネームと、ステージ一覧をまとめて取る
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

    box.append(
      list,
      makeButton("承認して公開", () => changeStatus(quest, "published")),
      makeButton("差し戻し", () => changeStatus(quest, "draft"))
    );
    pendingQuests.appendChild(box);
  }
}