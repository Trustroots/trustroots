Mass Emails
---

There are some scripts in here to send mass emails.

`mass-email-template.html` is the base template. It needs to be processed to
inline the styles, etc. It gets processed and is then saved on Sparkpost. Check
that it is up to date and send some tests before running the mass send script.

`mass-email-content.html` is the actual content of this email. It needs to be
merged into the `mass-email-template.html` file.

## Generate a combined HTML file

Generate a combined HTML file like so

    node mergeAndInline.js > message.html

## Generate a plain text version

Create a plain text version of the message.

    node generatePlainText.js > message.txt

## Upload that template to sparkpost

You need to be able to login to sparkpost for this.

Copy the HTML from `message.html` and the plain text from `message.txt` into the
`mass-email` template.

    cat message.html | pbcopy
    cat message.txt | pbcopy

## Set the subject on sparkpost

This is **crucial**. It must be **updated manually every time**.

## Send a test email

Here's an example for the TEST DATA field.

```json
{
  "substitution_data": {
    "userToName": "Callum Macdonald"
  },
  "metadata": {},
  "options": {},
  "content": {
    "subject": "A subject"
  }
}
```
