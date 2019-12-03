import { Children, cloneElement, useEffect } from 'react';
import { selectPhoto } from '../services/photos.service';

export default function Board({ name='bokeh', children, onNameChanged }) {

  // update
  useEffect(() => {
    onNameChanged({ name: selectPhoto(name) });
  }, [name]);

  const photo = selectPhoto(name);
  const style = { backgroundImage: `url("${photo.imageUrl}")` };
  return Children.map(children, child => cloneElement(child, { style }));
}
