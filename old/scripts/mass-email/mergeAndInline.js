const inline = require("inline-css");

const fs = require("fs");

const paths = {
  template: "./mass-email-template.html",
  content: "./mass-email-content.html"
};

templateHtml = fs.readFileSync(paths.template, { encoding: "utf-8" });
contentHtml = fs.readFileSync(paths.content, { encoding: "utf-8" });

combinedHtml = templateHtml.replace("{{ mass-email-content }}", contentHtml);

inline(combinedHtml, {
  url: "https://www.trustroots.org/"
}).then(inlinedHtml => {
  console.log(inlinedHtml);
});
