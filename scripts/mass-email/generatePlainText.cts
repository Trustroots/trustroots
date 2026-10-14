const htmlToText = require('html-to-text') as {
  fromFile(
    filename: string,
    options: { wordwrap: number },
    callback: (error: unknown, text: string) => void,
  ): void;
};

htmlToText.fromFile(
  './mass-email-content.html',
  {
    wordwrap: 70,
  },
  (err, text) => {
    if (err) return console.error(err);
    console.log(text);
  },
);
