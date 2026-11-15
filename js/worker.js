// Pyodideを読み込む(Workerの中ではimportScriptsを使う)
importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js");

let pyodide = null;

// 準備:Pyodideを読み込んで、出力の送り先を設定する
async function setup() {
  pyodide = await loadPyodide();

  pyodide.setStdout({
    batched: (line) => postMessage({ type: "stdout", text: line }),
  });
  pyodide.setStderr({
    batched: (line) => postMessage({ type: "stdout", text: line }),
  });

  postMessage({ type: "ready" });
}

// 画面側からのメッセージを受け取る
onmessage = async (event) => {
  const message = event.data;

  if (message.type === "run") {
    try {
      await pyodide.runPythonAsync(message.code);
    } catch (error) {
      postMessage({ type: "error", text: error.message });
    }
    postMessage({ type: "done" });
  }
};

setup();