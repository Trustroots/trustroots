import React, { useEffect, useState } from 'react';
import { getCircles, saveCircle } from '../api/circles.api';
import AdminHeader from './AdminHeader.component';

const emptyCircle = {
  label: '',
  color: '345d5c',
  public: true,
  attribution: '',
  attribution_url: '',
  description: '',
};

function imageUrl(circle) {
  return circle.image ? `/uploads-circle/${circle.slug}/120x120.jpg` : null;
}

export default function AdminCircles() {
  const [circles, setCircles] = useState([]);
  const [circle, setCircle] = useState(emptyCircle);
  const [image, setImage] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function loadCircles() {
    setCircles(await getCircles());
  }

  useEffect(() => {
    loadCircles().catch(() => setError('Could not load circles.'));
  }, []);

  function editCircle(selected) {
    setCircle({ ...selected });
    setImage(null);
    setMessage(null);
    setError(null);
  }

  async function submit(event) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const saved = await saveCircle(circle, image);
      setCircle(saved);
      setImage(null);
      await loadCircles();
      setMessage('Circle saved.');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Could not save circle.',
      );
    }
  }

  const update = event => {
    const { name, value, type, checked } = event.target;
    setCircle(current => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
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
          <button
            className="btn btn-default"
            onClick={() => editCircle(emptyCircle)}
            type="button"
          >
            New circle
          </button>
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
                  The URL slug is generated from the name.
                </p>
              </div>
              <div className="form-group">
                <label htmlFor="circle-description">Description</label>
                <textarea
                  className="form-control"
                  id="circle-description"
                  name="description"
                  onChange={update}
                  rows="4"
                  value={circle.description || ''}
                />
              </div>
              <div className="row">
                <div className="col-sm-4 form-group">
                  <label htmlFor="circle-color">Colour</label>
                  <input
                    className="form-control"
                    id="circle-color"
                    maxLength="6"
                    minLength="6"
                    name="color"
                    onChange={update}
                    pattern="[0-9a-fA-F]{6}"
                    required
                    value={circle.color || ''}
                  />
                </div>
                <div className="col-sm-8 form-group">
                  <label htmlFor="circle-image">Image</label>
                  <input
                    accept="image/jpeg,image/png,image/gif"
                    className="form-control"
                    id="circle-image"
                    onChange={event => setImage(event.target.files[0])}
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
              <button className="btn btn-primary" type="submit">
                Save circle
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

AdminCircles.propTypes = {};
