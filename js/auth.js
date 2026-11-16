const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const userText = document.getElementById("user");
const profileEdit = document.getElementById("profile-edit");
const nicknameInput = document.getElementById("nickname-input");
const nicknameSave = document.getElementById("nickname-save");
const nicknameMessage = document.getElementById("nickname-message");

let currentUser = null;    // ログイン中のユーザー(いなければ null)
let currentProfile = null; // プロフィール { nickname, role }

const ROLE_LABELS = { student: "受講者", author: "作者", admin: "管理者" };

// プロフィールをSupabaseから取ってくる
async function loadProfile() {
  if (currentUser === null) {
    currentProfile = null;
    return;
  }
  const { data, error } = await db
    .from("profiles")
    .select("nickname, role")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    console.error(error);
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

  if (!loggedIn) {
    userText.textContent = "ログインしていません";
    return;
  }
  if (currentProfile === null) {
    userText.textContent = "ログイン中";
    return;
  }
  const roleLabel = ROLE_LABELS[currentProfile.role] || "";
  userText.textContent = "ログイン中: " + currentProfile.nickname + "(" + roleLabel + ")";
  nicknameInput.value = currentProfile.nickname;
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
