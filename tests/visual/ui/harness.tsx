import '../../../config/vite/load-styles.ts';

import React, { type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert } from '@trustroots/ui/Alert';
import { Badge } from '@trustroots/ui/Badge';
import { Button } from '@trustroots/ui/Button';
import { Spinner } from '@trustroots/ui/Spinner';

function Shot({ id, children }: { id: string; children: ReactNode }) {
  // Padding leaves room for the 2px focus outline and its 2px offset. Each
  // shot has its own row so a size change cannot shift the next fixture.
  return (
    <div style={{ margin: 4 }}>
      <div
        data-shot={id}
        style={{ display: 'inline-block', padding: 8, background: '#fff' }}
      >
        {children}
      </div>
    </div>
  );
}

const rtl = document.documentElement.dir === 'rtl';
const text = rtl
  ? {
      save: 'حفظ التغييرات',
      alert: 'حدث خطأ ما. حاول مرة أخرى.',
      badge: 'جديد',
    }
  : {
      save: 'Save changes',
      alert: 'Snap! Something went wrong.',
      badge: 'New',
    };

function Fixtures() {
  return (
    <div style={{ padding: 16, width: 640 }}>
      {(['primary', 'default'] as const).map(variant => (
        <div key={variant}>
          <Shot id={`button-${variant}`}>
            <Button variant={variant}>{text.save}</Button>
          </Shot>
          <Shot id={`button-${variant}-disabled`}>
            <Button variant={variant} disabled>
              {text.save}
            </Button>
          </Shot>
        </div>
      ))}
      <Shot id="button-submit">
        <Button type="submit">{text.save}</Button>
      </Shot>
      <div style={{ width: 360 }}>
        <Shot id="alert">
          <Alert>{text.alert}</Alert>
        </Shot>
      </div>
      <Shot id="badge">
        <span>
          {text.save} <Badge>{text.badge}</Badge>
        </span>
      </Shot>
      <Shot id="badge-heading">
        <h3 style={{ margin: 0 }}>
          {text.save} <Badge>{text.badge}</Badge>
        </h3>
      </Shot>
      <Shot id="spinner">
        <span>
          <Spinner label="Loading" /> {text.save}
        </span>
      </Shot>
      <Shot id="spinner-heading">
        <h3 style={{ margin: 0 }}>
          <Spinner label="Loading" /> {text.save}
        </h3>
      </Shot>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Fixtures />);
