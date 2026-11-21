import { useEffect, useState, type ReactElement } from 'react';
import { render } from 'react-email';

/** The email's HTML as sent, isolated from the page's styles in an iframe. */
export function EmailPreview({ email }: { email: ReactElement }) {
  const [html, setHtml] = useState<string>();
  const [height, setHeight] = useState(0);
  useEffect(() => {
    void render(email).then(setHtml);
  }, [email]);
  return html ? (
    <iframe
      title="Email"
      srcDoc={html}
      style={{ display: 'block', width: '100%', border: 0, height }}
      onLoad={event =>
        setHeight(
          event.currentTarget.contentDocument?.documentElement.scrollHeight ??
            0,
        )
      }
    />
  ) : null;
}
