const inline = require('inline-css') as (
  html: string,
  options: { url: string },
) => Promise<string>;

const fs = require('node:fs') as typeof import('node:fs');

const paths = {
  template: './mass-email-template.html',
  content: './mass-email-content.html',
};

const templateHtml = fs.readFileSync(paths.template, { encoding: 'utf-8' });
const contentHtml = fs.readFileSync(paths.content, { encoding: 'utf-8' });

const combinedHtml = templateHtml.replace(
  '{{ mass-email-content }}',
  contentHtml,
);

inline(combinedHtml, {
  url: 'https://www.trustroots.org/',
}).then(inlinedHtml => {
  console.log(inlinedHtml);
});
