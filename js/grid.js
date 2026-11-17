// カードのグリッド。一番下までスクロールすると、次のぶんを読み込む
function createInfiniteGrid(options) {
  const gridEl = options.gridEl;
  const statusEl = options.statusEl;
  const pageSize = options.pageSize;

  let loaded = 0;       // 読み込んだ件数
  let loading = false;  // 読み込み中か
  let finished = false; // 最後まで読み込んだか
  let generation = 0;   // リセット世代管理

  // グリッドの下に置く目印。これが見えたら、次を読み込む
  const sentinel = document.createElement("div");
  sentinel.className = "grid-sentinel";
  gridEl.after(sentinel);

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    },
    { rootMargin: "100px" }
  );

  async function loadMore() {
    if (loading || finished) return;
    loading = true;
    const myGen = generation;
    statusEl.textContent = "読み込み中…";

    const { data, error } = await options.fetchPage(loaded, loaded + pageSize - 1);
    if (myGen !== generation) return;
    loading = false;

    if (error) {
      console.error(error);
      statusEl.textContent = "読み込めませんでした";
      return;
    }

    for (const row of data) gridEl.appendChild(options.createCard(row));
    loaded += data.length;
    statusEl.textContent = "";
    if (options.onAppended) options.onAppended(data);

    if (data.length < pageSize) {
      finished = true; // 20件に満たなければ、これが最後
      observer.disconnect();
      if (loaded === 0) statusEl.textContent = options.emptyText;
    } else {
      // 目印がまだ見えているときも、続けて読み込む
      observer.unobserve(sentinel);
      observer.observe(sentinel);
    }
  }

  function reset() {
    generation++;
    loaded = 0;
    loading = false;
    finished = false;
    gridEl.textContent = "";
    statusEl.textContent = "";
    observer.disconnect();
    observer.observe(sentinel);
  }

  observer.observe(sentinel);
  return { reset };
}