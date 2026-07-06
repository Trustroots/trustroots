import fs from 'fs';
import path from 'path';

describe('profile edit photo template', function () {
  let root;

  beforeEach(function () {
    const template = fs.readFileSync(
      path.join(
        __dirname,
        '../../client/views/profile/profile-edit-photo.client.view.html',
      ),
      'utf8',
    );

    root = document.createElement('div');
    root.innerHTML = template;
  });

  it('uses real file inputs for Firefox-compatible photo selection', function () {
    const fileInput = root.querySelector('#profile-edit-avatar-file');
    const cameraInput = root.querySelector('#profile-edit-avatar-camera');

    expect(fileInput.tagName).toBe('INPUT');
    expect(fileInput.getAttribute('type')).toBe('file');
    expect(fileInput.getAttribute('ngf-select')).toContain('fileSelected');
    expect(root.querySelector('button#profile-edit-avatar-file')).toBeNull();

    expect(cameraInput.tagName).toBe('INPUT');
    expect(cameraInput.getAttribute('type')).toBe('file');
    expect(cameraInput.getAttribute('ngf-capture')).toBe("'camera'");
    expect(cameraInput.getAttribute('ngf-select')).toContain('fileSelected');
    expect(root.querySelector('button#profile-edit-avatar-camera')).toBeNull();
  });
});
