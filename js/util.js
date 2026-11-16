// HTMLの部品を作る補助関数(文字は、必ず textContent で入れる)
function el(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}
