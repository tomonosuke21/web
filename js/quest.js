const questId = Number(new URLSearchParams(window.location.search).get("id"));

const questTitleEl = document.getElementById("quest-title");
const questInfoEl = document.getElementById("quest-info");
const questDescEl = document.getElementById("quest-description");
const stageListEl = document.getElementById("stage-list");

const stageBadges = new Map(); // ステージID: 「クリア済み」バッジ

// 自分がクリアしたステージに、バッジを出す
async function refreshBadges() {
  for (const badge of stageBadges.values()) badge.hidden = true;
  if (currentUser === null || stageBadges.size === 0) return;

  const { data, error } = await db
    .from("stage_progress")
    .select("stage_id")
    .in("stage_id", [...stageBadges.keys()]);
  if (error) {
    console.error(error);
    return;
  }
  for (const row of data) {
    const badge = stageBadges.get(row.stage_id);
    if (badge) badge.hidden = false;
  }
}

async function loadQuest() {
  if (!Number.isInteger(questId) || questId <= 0) {
    questTitleEl.textContent ="問題が指定されていません";
    return;
  }

  const { data: quest, error } = await db
    .from("quests")
    .select("id, title, description, language, difficulty, minutes")
    .eq("id", questId)
    .single();
  if (error || !quest) {
    console.error(error);
    questTitleEl.textContent ="問題を読み込めませんでした";
    return;
  }

  questTitleEl.textContent = quest.title;
  questInfoEl.textContent =
    (DIFFICULTY_LABELS[quest.difficulty] || "") + " / " +
    (LANGUAGE_LABELS[quest.language] || quest.language) + " / 約" + quest.minutes + "分";
  questDescEl.textContent = quest.description;

  const { data: stages, error: stageError } = await db
    .from("stages")
    .select("id, position, kind, title")
    .eq("quest_id", questId)
    .order("position");
  if (stageError) {
    console.error(stageError);
    stageListEl.textContent = "ステージを読み込めませんでした";
    return;
  }

  stages.forEach((stage, index) => {
    const row = el("a");
    row.className = "grid-card";
    row.href = "stage.html?id=" + stage.id;

    const number = el("span", String(index + 1));
    number.className = "stage-number";
    const kind = el("span", STAGE_KIND_LABELS[stage.kind] || stage.kind);
    kind.className = "stage-kind";
    const title = el("span", stage.title);
    title.className = "stage-title";

    const badge = el("span", "クリア済み");
    badge.className = "done-badge";
    badge.hidden = true;
    stageBadges.set(stage.id, badge);

    row.append(number, kind, title, badge);
    stageListEl.appendChild(row);
  });

  await refreshBadges();
}

document.addEventListener("auth-ready", refreshBadges);
loadQuest();