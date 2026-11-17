// 全ページ共通のヘッダーとサイドバーを作る
(function () {
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function makeLink(label, href, className) {
    const a = make("a", className, label);
    a.href = href;
    return a;
  }

  // 今のページに合わせて、サイドバーのどれを光らせるか決める
  let active = document.body.dataset.page || "";
  if (active === "quest") active = "quests";
  if (active === "stage") {
    const from = new URLSearchParams(window.location.search).get("from");
    active = from === "problems" || from === "new" ? from : "quests";
  }

  // ----- ヘッダー(左にタイトル、右にナビ) -----
  const header = make("header", "site-header");
  const inner = make("div", "site-header-inner");
  const nav = make("nav", "site-nav");
  nav.append(makeLink("練習問題", "index.html"), makeLink("クエスト一覧", "quests.html"));
  inner.append(makeLink("プログラミング（仮）", "index.html", "site-title"), nav);
  header.appendChild(inner);

  // ----- サイドバー -----
  const menu = [
    { key: "problems", label: "練習問題", href: "index.html" },
    { key: "quests", label: "クエスト一覧", href: "quests.html" },
    { key: "new", label: "新着問題", href: "new.html" },
    { key: "editor", label: "問題を作る", href: "editor.html" },
  ];
  const sideNav = make("nav", "sidebar-nav");
  let createLink = null;
  for (const item of menu) {
    const link = makeLink(item.label, item.href, item.key === active ? "active" : "");
    if (item.key === "editor") {
      link.hidden = true; // 作者・管理者だけに見せる(下で切り替える)
      createLink = link;
    }
    sideNav.appendChild(link);
  }

  // ----- ログインとニックネーム(auth.js が、この id を探す) -----
  const account = make("div", "sidebar-account");

  const login = make("button", "", "GitHubでログイン");
  login.id = "login";
  const logout = make("button", "secondary", "ログアウト");
  logout.id = "logout";
  logout.hidden = true;
  const user = make("span");
  user.id = "user";

  const edit = make("div");
  edit.id = "profile-edit";
  edit.hidden = true;
  const label = make("label", "", "ニックネーム");
  label.htmlFor = "nickname-input";
  const input = make("input");
  input.id = "nickname-input";
  input.type = "text";
  input.maxLength = 20;
  const save = make("button", "", "保存");
  save.id = "nickname-save";
  const message = make("span");
  message.id = "nickname-message";
  edit.append(label, input, save, message);

  account.append(login, logout, user, edit);

  const sidebarInner = make("div", "sidebar-inner");
  sidebarInner.append(sideNav, account);
  const sidebar = make("aside", "sidebar");
  sidebar.appendChild(sidebarInner);

  // ----- ページの中身を、右側に移す(scriptは動かさない) -----
  const content = make("div", "app-content");
  for (const node of Array.from(document.body.childNodes)) {
    if (node.nodeName !== "SCRIPT") content.appendChild(node);
  }

  const shell = make("div", "app-shell");
  shell.append(sidebar, content);
  document.body.prepend(header, shell);

  // ログイン状態が分かったら、「問題を作る」を出すか決める
  document.addEventListener("auth-ready", () => {
    const role = currentProfile ? currentProfile.role : null;
    createLink.hidden = !(role === "author" || role === "admin");
  });
})();