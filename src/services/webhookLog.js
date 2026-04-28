const MAX_ENTRIES = 100;
const entries = [];

function record(data) {
  if (entries.length >= MAX_ENTRIES) entries.shift();
  entries.push({ ts: new Date().toISOString(), ...data });
}

function getEntries() {
  return [...entries].reverse();
}

module.exports = { record, getEntries };
