const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {
  removeLocalPath,
} = require('../../../server/services/file-removal.server.service.mjs');

describe('Local file removal', () => {
  let root;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(process.cwd(), 'tmp-file-removal-'));
  });
  afterEach(async () => fs.rm(root, { recursive: true, force: true }));

  it('removes nested uploads and tolerates already missing paths', async () => {
    const uploads = path.join(root, 'uploads');
    await fs.mkdir(path.join(uploads, 'avatar'), { recursive: true });
    await fs.writeFile(path.join(uploads, 'avatar', 'image.png'), 'fixture');
    await removeLocalPath(uploads);
    await assert.rejects(fs.stat(uploads), { code: 'ENOENT' });
    await removeLocalPath(uploads);
  });

  it('removes a symlink without removing its target', async () => {
    const target = path.join(root, 'target');
    const link = path.join(root, 'link');
    await fs.mkdir(target);
    await fs.writeFile(path.join(target, 'keep.txt'), 'fixture');
    await fs.symlink(target, link);
    await removeLocalPath(link);
    assert.equal(
      await fs.readFile(path.join(target, 'keep.txt'), 'utf8'),
      'fixture',
    );
    await assert.rejects(fs.lstat(link), { code: 'ENOENT' });
  });

  it('rejects the working directory and paths outside it', async () => {
    for (const target of [
      '.',
      '..',
      '../outside',
      path.resolve('../trustroots-other/file'),
    ]) {
      await assert.rejects(removeLocalPath(target), /Cannot delete/);
    }
  });
});
