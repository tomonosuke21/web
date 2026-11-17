importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js");

let pyodide = null;
let inputLines = []; // input() が読み込む行(先頭から順に渡す)

async function setup() {
  pyodide = await loadPyodide();

  pyodide.setStdout({
    batched: (line) => postMessage({ type: "stdout", text: line }),
  });
  pyodide.setStderr({
    batched: (line) => postMessage({ type: "stdout", text: line }),
  });

  // input() が呼ばれたら、inputLines の先頭を1行返す(なくなったら undefined)
  pyodide.setStdin({
    stdin: () => (inputLines.length > 0 ? inputLines.shift() : undefined),
  });

  postMessage({ type: "ready" });
}

onmessage = async (event) => {
  const message = event.data;

  if (message.type === "run") {
    inputLines = message.input ? message.input.split("
") : [];

    // 実行ごとに新しい変数の入れ物を作る(前の実行の変数を引き継がない)
    const namespace = pyodide.globals.get("dict")();
    namespace.set("__name__", "__main__");

    try {
      await pyodide.runPythonAsync(message.code, { globals: namespace });
    } catch (error) {
      postMessage({ type: "error", text: error.message });
    }
    namespace.destroy();
    postMessage({ type: "done" });
  }
};

setup();