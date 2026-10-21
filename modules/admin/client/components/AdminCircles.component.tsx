import React, { useEffect, useRef, useState } from 'react';
import { getCircles, saveCircle, type AdminCircle } from '../api/circles.api';
import AdminHeader from './AdminHeader.component';
import { Button } from '@trustroots/ui';

const suggestedColours = [
  '1e3a8a',
  '1e40af',
  '065f46',
  '166534',
  '854d0e',
  '92400e',
  '9a3412',
  '991b1b',
  '6b21a8',
  '86198f',
  '155e75',
  '334155',
];

const emptyCircle: AdminCircle = {
  label: '',
  color: suggestedColours[0],
  public: true,
  attribution: '',
  attribution_url: '',
  description: '',
};

function channelLuminance(value: number) {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function whiteLabelIsReadable(color: string) {
  if (!/^[0-9a-fA-F]{6}$/.test(color)) return true;
  const luminance = [0, 2, 4]
    .map(offset =>
      channelLuminance(parseInt(color.slice(offset, offset + 2), 16)),
    )
    .reduce(
      (total, channel, index) =>
        total + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );
  return 1.05 / (luminance + 0.05) >= 3;
}

function imageUrl(circle: AdminCircle) {
  if (!circle.image) return undefined;
  const version = circle.modified ? new Date(circle.modified).getTime() : 0;
  return `/uploads-circle/${circle.slug}/120x120.jpg${
    version ? `?v=${version}` : ''
  }`;
}

export default function AdminCircles() {
  const [circles, setCircles] = useState<AdminCircle[]>([]);
  const [circle, setCircle] = useState<AdminCircle>(emptyCircle);
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const saving = useRef(false);

  async function loadCircles() {
    setCircles(await getCircles());
  }

  useEffect(() => {
    loadCircles().catch(() => setError('Could not load circles.'));
  }, []);

  function clearSelectedImage() {
    setImage(null);
    imageInput.current!.value = '';
  }

  function editCircle(selected: AdminCircle) {
    setCircle({ ...selected });
    clearSelectedImage();
    setMessage(null);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saved = await saveCircle(circle, image);
      setCircle(saved);
      clearSelectedImage();
      setMessage('Circle saved.');
      try {
        await loadCircles();
      } catch {
        setError('Circle saved, but the catalogue could not be reloaded.');
      }
    } catch (requestError) {
      const apiMessage = (
        requestError as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      setError(apiMessage || 'Could not save circle.');
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  const update = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const target = event.currentTarget;
    const { name, value } = target;
    const isCheckbox =
      target instanceof HTMLInputElement && target.type === 'checkbox';
    const nextValue = isCheckbox ? (target as HTMLInputElement).checked : value;
    setCircle(current => ({
      ...current,
      [name]: nextValue,
    }));
  };

  return (
    <>
      <AdminHeader />
      <div className="container admin-circles-page">
        <div className="admin-circles-heading">
          <div>
            <h2>Circles</h2>
            <p className="text-muted">
              Create and maintain the public circle catalogue.
            </p>
          </div>
          <Button
            variant="default"
            onClick={() => editCircle(emptyCircle)}
            type="button"
          >
            New circle
          </Button>
        </div>
        {message && <p className="text-success">{message}</p>}
        {error && <p className="text-danger">{error}</p>}
        <div className="row">
          <div className="col-sm-5">
            <div className="list-group" aria-label="Circles">
              {circles.map(item => (
                <button
                  className="list-group-item"
                  key={item._id}
                  onClick={() => editCircle(item)}
                  type="button"
                >
                  {item.label}
                  <span className="pull-right text-muted">
                    {item.public ? `${item.count} members` : 'Hidden'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="col-sm-7">
            <form onSubmit={submit}>
              <div className="form-group">
                <label htmlFor="circle-label">Name</label>
                <input
                  className="form-control"
                  id="circle-label"
                  name="label"
                  onChange={update}
                  required
                  value={circle.label}
                />
                <p className="help-block">
                  The URL slug is generated from the name when the circle is
                  created and stays the same if the name changes.
                </p>
              </div>
              <div className="form-group">
                <label htmlFor="circle-description">Description</label>
                <textarea
                  className="form-control"
                  id="circle-description"
                  name="description"
                  onChange={update}
                  maxLength={4000}
                  rows={4}
                  value={circle.description || ''}
                />
                <p className="help-block">Up to 4000 characters.</p>
              </div>
              <div className="row">
                <div className="col-sm-4 form-group">
                  <label htmlFor="circle-color">Colour</label>
                  <input
                    className="form-control"
                    id="circle-color"
                    list="circle-colours"
                    maxLength={6}
                    minLength={6}
                    name="color"
                    onChange={update}
                    pattern="[0-9a-fA-F]{6}"
                    required
                    value={circle.color || ''}
                  />
                  <datalist id="circle-colours">
                    {suggestedColours.map(colour => (
                      <option key={colour} value={colour} />
                    ))}
                  </datalist>
                  <p className="help-block">
                    Six hexadecimal characters. Suggested colours keep white
                    labels readable.
                  </p>
                  {circle.color && !whiteLabelIsReadable(circle.color) && (
                    <p className="help-block text-warning">
                      White labels will be hard to read on this colour.
                    </p>
                  )}
                </div>
                <div className="col-sm-8 form-group">
                  <label htmlFor="circle-image">Image</label>
                  <input
                    accept="image/jpeg,image/png,image/gif"
                    className="form-control"
                    id="circle-image"
                    onChange={event =>
                      setImage(event.currentTarget.files?.[0] || null)
                    }
                    ref={imageInput}
                    type="file"
                  />
                </div>
              </div>
              {imageUrl(circle) && (
                <img
                  alt="Current circle"
                  className="admin-circle-image"
                  src={imageUrl(circle)}
                />
              )}
              <div className="checkbox">
                <label>
                  <input
                    checked={circle.public}
                    name="public"
                    onChange={update}
                    type="checkbox"
                  />{' '}
                  Public
                </label>
                <p className="help-block">
                  Hiding a circle removes it from the public catalogue.
                  Memberships stay in place.
                </p>
              </div>
              <div className="form-group">
                <label htmlFor="circle-attribution">Image attribution</label>
                <input
                  className="form-control"
                  id="circle-attribution"
                  name="attribution"
                  onChange={update}
                  value={circle.attribution || ''}
                />
              </div>
              <div className="form-group">
                <label htmlFor="circle-attribution-url">Attribution URL</label>
                <input
                  className="form-control"
                  id="circle-attribution-url"
                  name="attribution_url"
                  onChange={update}
                  type="url"
                  value={circle.attribution_url || ''}
                />
              </div>
              <Button variant="primary" disabled={isSaving} type="submit">
                {isSaving ? 'Saving…' : 'Save circle'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
