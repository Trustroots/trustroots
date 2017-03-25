Mass Emails
---

There are some scripts in here to send mass emails.

`mass-email-template.html` is the base template. It needs to be processed to
inline the styles, etc. It gets processed and is then saved on Sparkpost. Check
that it is up to date and send some tests before running the mass send script.

`mass-email-content.html` is the actual content of this email. It needs to be
merged into the `mass-email-template.html` file.

Generate a combined HTML file like so

    node mergeAndInline.js > combined.html
