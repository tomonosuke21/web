const gridEl = document.getElementById("quest-grid");
const statusEl = document.getElementById("grid-status");
const keywordInput = document.getElementById("filter-keyword");
const difficultySelect = document.getElementById("filter-difficulty");

// 公開済みのクエストを、20件ずつ取る
function fetchQuestPage(from, to) {
  let query = db
    .from("quests")
    .select("id, title, description, language, difficulty, minutes")
    .eq("status", "published");

  const kw = keywordInput ? keywordInput.value.trim() : "";
  if (kw) {
    const safeKw = kw.replace(/[,()]/g, " ");
    query = query.or("title.ilike.%" + safeKw + "%,description.ilike.%" + safeKw + "%");
  }

  const diff = difficultySelect ? difficultySelect.value : "";
  if (diff) {
    query = query.eq("difficulty", Number(diff));
  }

  return query.order("id", { ascending: true }).range(from, to);
}

function createQuestCard(quest) {
  const card = el("a");
  card.className = "grid-card";
  card.href = "quest.html?id=" + quest.id;

  const desc = el("p", quest.description);
  desc.className = "grid-card-desc";

  const meta = el(
    "p",
    (DIFFICULTY_LABELS[quest.difficulty] || "") + " / " +
      (LANGUAGE_LABELS[quest.language] || quest.language) + " / 約" + quest.minutes + "分"
  );
  meta.className = "grid-card-meta";

  card.append(el("h3", quest.title), desc, meta);
  return card;
}

const gridController = createInfiniteGrid({
  gridEl: gridEl,
  statusEl: statusEl,
  pageSize: 20,
  emptyText: "条件に一致するクエストが見つかりませんでした",
  fetchPage: fetchQuestPage,
  createCard: createQuestCard,
});

let searchTimer = null;
if (keywordInput) {
  keywordInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => gridController.reset(), 250);
  });
}
if (difficultySelect) {
  difficultySelect.addEventListener("change", () => gridController.reset());
}