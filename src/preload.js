// Expose limited APIs to the renderer if needed
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  replaceText('node-version', process.versions.node);
  replaceText('chrome-version', process.versions.chrome);
  replaceText('electron-version', process.versions.electron);
});
