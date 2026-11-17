const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const userText = document.getElementById("user");
const profileEdit = document.getElementById("profile-edit");
const nicknameInput = document.getElementById("nickname-input");
const nicknameSave = document.getElementById("nickname-save");
const nicknameMessage = document.getElementById("nickname-message");

let currentUser = null;    // ログイン中のユーザー(いなければ null)
let currentProfile = null; // プロフィール { nickname, role, points }

const ROLE_LABELS = { student: "受講者", author: "作者", admin: "管理者" };

// プロフィールをSupabaseから取ってくる
async function loadProfile() {
  if (currentUser === null) {
    currentProfile = null;
    return;
  }
  const { data, error } = await db
    .from("profiles")
    .select("nickname, role, points")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    console.error("loadProfile error:", error);
    currentProfile = null;
    return;
  }
  currentProfile = data;
}

// 画面の表示を、今の状態に合わせる
function renderAuth() {
  const loggedIn = currentUser !== null;
  loginButton.hidden = loggedIn;
  logoutButton.hidden = !loggedIn;
  profileEdit.hidden = !loggedIn;

  let rankBox = document.getElementById("sidebar-rank-box");
  if (!rankBox && userText && userText.parentNode) {
    rankBox = document.createElement("div");
    rankBox.id = "sidebar-rank-box";
    rankBox.className = "sidebar-rank-box";
    userText.after(rankBox);
  }

  if (!loggedIn) {
    userText.textContent = "ログインしていません";
    if (rankBox) rankBox.hidden = true;
    return;
  }
  if (currentProfile === null) {
    userText.textContent = "ログイン中";
    if (rankBox) rankBox.hidden = true;
    return;
  }
  const roleLabel = ROLE_LABELS[currentProfile.role] || "";
  userText.textContent = "ログイン中: " + currentProfile.nickname + "(" + roleLabel + ")";
  nicknameInput.value = currentProfile.nickname;

  if (rankBox) {
    const pts = Math.max(0, Number(currentProfile.points) || 0);
    const rank = typeof calcRank === "function" ? calcRank(pts) : Math.min(100, Math.floor(pts / 100) + 1);
    const rem = typeof calcNextRankRemaining === "function" ? calcNextRankRemaining(pts) : (rank >= 100 ? 0 : rank * 100 - pts);
    const pct = rank >= 100 ? 100 : (pts % 100);

    rankBox.hidden = false;
    rankBox.textContent = "";

    const topRow = document.createElement("div");
    topRow.className = "rank-top-row";
    const lvBadge = document.createElement("span");
    lvBadge.className = "rank-lv-badge";
    lvBadge.textContent = "Lv." + rank;
    const ptSpan = document.createElement("span");
    ptSpan.className = "rank-pt-text";
    ptSpan.textContent = pts + " pt";
    topRow.append(lvBadge, ptSpan);

    const barTrack = document.createElement("div");
    barTrack.className = "rank-bar-track";
    const barFill = document.createElement("div");
    barFill.className = "rank-bar-fill";
    barFill.style.width = pct + "%";
    barTrack.appendChild(barFill);

    const subText = document.createElement("div");
    subText.className = "rank-sub-text";
    subText.textContent = rank >= 100 ? "MAX ランク到達 (Lv.100)" : "次のランクまであと " + rem + " pt";

    rankBox.append(topRow, barTrack, subText);
  }
}

// ポイントを加算してプロフィールを更新する
async function addPoints(delta) {
  const addVal = Math.floor(Number(delta) || 0);
  if (!currentUser || addVal <= 0) return null;

  // 最新のポイントをDBから直接取得して計算ずれを防ぐ
  const { data: latest, error: fetchError } = await db
    .from("profiles")
    .select("nickname, role, points")
    .eq("id", currentUser.id)
    .single();

  if (fetchError || !latest) {
    console.error("ポイント取得エラー:", fetchError);
    return null;
  }

  currentProfile = latest;
  const oldPts = Math.max(0, Number(latest.points) || 0);
  const oldRank = typeof calcRank === "function" ? calcRank(oldPts) : Math.min(100, Math.floor(oldPts / 100) + 1);
  const newPts = oldPts + addVal;
  const newRank = typeof calcRank === "function" ? calcRank(newPts) : Math.min(100, Math.floor(newPts / 100) + 1);

  // .select("points") を付けて実際に更新された行が返るか確認する
  const { data: updatedRows, error: updateError } = await db
    .from("profiles")
    .update({ points: newPts })
    .eq("id", currentUser.id)
    .select("points");

  if (updateError || !updatedRows || updatedRows.length === 0) {
    console.error("ポイント更新エラー(RLSポリシー等でブロックされた可能性があります):", updateError);
    return null;
  }

  const savedPts = Math.max(0, Number(updatedRows[0].points) || newPts);
  const finalRank = typeof calcRank === "function" ? calcRank(savedPts) : Math.min(100, Math.floor(savedPts / 100) + 1);

  if (currentProfile) {
    currentProfile.points = savedPts;
  }
  renderAuth();
  return { added: addVal, oldPts, newPts: savedPts, oldRank, newRank: finalRank };
}

// ログイン状態が変わるたびに呼ばれる(ページを開いた直後も1回呼ばれる)
db.auth.onAuthStateChange((event, session) => {
  currentUser = session ? session.user : null;
  renderAuth(); // まず、ログイン状態だけ反映する

  // プロフィールは少し待ってから取る
  // (コールバックの中で直接Supabaseを呼ぶと、止まることがあるため)
  setTimeout(async () => {
    await loadProfile();
    renderAuth();
    if (typeof onAuthReady === "function") onAuthReady();
    document.dispatchEvent(new Event("auth-ready"));
  }, 0);
});

// GitHubでログイン
loginButton.addEventListener("click", () => {
  db.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
});

logoutButton.addEventListener("click", () => {
  db.auth.signOut();
});

// ニックネームを保存する
nicknameSave.addEventListener("click", async () => {
  const name = nicknameInput.value.trim();
  if (name.length < 2 || name.length > 20) {
    nicknameMessage.textContent = "2〜20文字で入力してください";
    return;
  }

  nicknameSave.disabled = true;
  const { error } = await db
    .from("profiles")
    .update({ nickname: name })
    .eq("id", currentUser.id);
  nicknameSave.disabled = false;

  if (error) {
    console.error(error);
    // 23505 は「すでにその名前がある」というエラー番号
    nicknameMessage.textContent =
      error.code === "23505" ? "その名前はすでに使われています" : "保存に失敗しました";
    return;
  }

  nicknameMessage.textContent = "保存しました";
  await loadProfile();
  renderAuth();
});

// 成績を保存する(結果を、画面に出すメッセージで返す)
async function saveResult(problemId, passed, code) {
  if (currentUser === null) {
    return "ログインすると成績が保存されます";
  }
  const { error } = await db.from("results").insert({
    problem_id: problemId,
    passed: passed,
    code: code,
  });
  if (error) {
    console.error(error);
    return "保存に失敗しました";
  }
  return "成績を保存しました";
}