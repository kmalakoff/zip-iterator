const path = require('path');

const TMP_DIR = path.join(path.join(__dirname, '..', '..', '.tmp'));
const TARGET = path.join(path.join(TMP_DIR, 'target'));
const DATA_DIR = path.join(path.join(__dirname, '..', 'data'));
const CONTENTS = '// eslint-disable-next-line no-unused-vars\nvar thing = true;\n';

module.exports = {
  TMP_DIR: TMP_DIR,
  TARGET: TARGET,
  DATA_DIR: DATA_DIR,
  CONTENTS: CONTENTS,
};
