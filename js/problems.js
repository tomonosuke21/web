const gridEl = document.getElementById("problem-grid");
const statusEl = document.getElementById("grid-status");
const keywordInput = document.getElementById("filter-keyword");
const difficultySelect = document.getElementById("filter-difficulty");
const unsolvedCheck = document.getElementById("filter-unsolved");

// new.html のときは、新しい順に並べる
const isNewPage = document.body.dataset.page === "new";
const fromParam = isNewPage ? "new" : "problems";

const badges = new Map(); // ステージID -> 「クリア済み」バッジ
const cards = new Map();  // ステージID -> カード要素
let solvedIds = new Set();

function formatDate(iso) {
  const d = new Date(iso);
  return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
}

// 公開済みクエストの「練習問題」ステージを、20件ずつ取る
function fetchProblemPage(from, to) {
  let query = db
    .from("stages")
    .select("id, title, created_at, quests!inner(title, difficulty, language, status)")
    .eq("kind", "problem")
    .eq("quests.status", "published");

  const kw = keywordInput ? keywordInput.value.trim() : "";
  if (kw) {
    query = query.ilike("title", "%" + kw + "%");
  }

  const diff = difficultySelect ? difficultySelect.value : "";
  if (diff) {
    query = query.eq("quests.difficulty", Number(diff));
  }

  if (isNewPage) {
    query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
  } else {
    query = query.order("id", { ascending: true });
  }
  return query.range(from, to);
}

function applyUnsolvedVisibility() {
  const onlyUnsolved = unsolvedCheck && unsolvedCheck.checked;
  for (const [id, card] of cards.entries()) {
    const isDone = solvedIds.has(id);
    const badge = badges.get(id);
    if (badge) badge.hidden = !isDone;
    card.hidden = Boolean(onlyUnsolved && isDone);
  }
}

function createProblemCard(row) {
  const quest = row.quests;

  const card = el("a");
  card.className = "grid-card";
  card.href = "stage.html?id=" + row.id + "&from=" + fromParam;

  const sub = el("p", quest.title);
  sub.className = "grid-card-sub";

  const metaText =
    (DIFFICULTY_LABELS[quest.difficulty] || "") + " / " +
    (LANGUAGE_LABELS[quest.language] || quest.language) +
    (isNewPage ? " / " + formatDate(row.created_at) : "");
  const meta = el("p", metaText);
  meta.className = "grid-card-meta";

  const badge = el("span", "クリア済み");
  badge.className = "done-badge";
  badge.hidden = true;
  badges.set(row.id, badge);
  cards.set(row.id, card);

  card.append(el("h3", row.title), sub, meta, badge);
  return card;
}

// 自分がクリアしたものに、バッジを出す
async function showBadges(ids) {
  if (currentUser === null || ids.length === 0) {
    applyUnsolvedVisibility();
    return;
  }

  const { data, error } = await db
    .from("stage_progress")
    .select("stage_id")
    .in("stage_id", ids);
  if (error) {
    console.error(error);
    return;
  }
  for (const row of data) {
    solvedIds.add(row.stage_id);
  }
  applyUnsolvedVisibility();
}

const gridController = createInfiniteGrid({
  gridEl: gridEl,
  statusEl: statusEl,
  pageSize: 20,
  emptyText: "条件に一致する問題が見つかりませんでした",
  fetchPage: fetchProblemPage,
  createCard: createProblemCard,
  onAppended: (rows) => showBadges(rows.map((r) => r.id)),
});

function resetAndReload() {
  badges.clear();
  cards.clear();
  gridController.reset();
}

let searchTimer = null;
if (keywordInput) {
  keywordInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(resetAndReload, 250);
  });
}
if (difficultySelect) {
  difficultySelect.addEventListener("change", resetAndReload);
}
if (unsolvedCheck) {
  unsolvedCheck.addEventListener("change", applyUnsolvedVisibility);
}

// ログイン・ログアウトのたびに、バッジを付け直す
document.addEventListener("auth-ready", async () => {
  solvedIds.clear();
  for (const badge of badges.values()) badge.hidden = true;
  await showBadges([...badges.keys()]);
});