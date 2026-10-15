// Keep initial audio downloads and decoding from competing all at once.
window.createLoadQueue = function createLoadQueue(limit = 2) {
  let active = 0;
  const pending = [];
  function drain() {
    while (active < limit && pending.length) {
      const { task, resolve, reject } = pending.shift();
      active++;
      Promise.resolve().then(task).then(resolve, reject).finally(() => { active--; drain(); });
    }
  }
  const run = (task, key) => new Promise((resolve, reject) => { pending.push({ task, key, resolve, reject }); drain(); });
  run.prioritize = key => {
    const index = pending.findIndex(item => item.key === key);
    if (index > 0) pending.unshift(pending.splice(index, 1)[0]);
  };
  return run;
};
