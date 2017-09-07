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

## Optionally minify the HTML

You can run the HTML through [a
minifier](https://kangax.github.io/html-minifier/) if you like.

## Generate a plain text version

Create a plain text version of the message.

    node generatePlainText.js > message.txt

Then you need to add the plain text footer before sending it.

    cat mass-email-footer.txt >> message.txt

## Update utm_campaign

Change `utm_campaign` in both `message.txt` and `message.html` to be unique for
this email.

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
    "displayName": "Callum Macdonald"
  },
  "metadata": {},
  "options": {},
  "content": {
    "subject": "A subject"
  }
}
```

## Dump users, load data

Dump users on the production server like:

    mongoexport --db trust-roots --collection users --out users.json

Grab that `users.json` file and drop it into a local `data/` directory in this
directory on your machine.

Run the `loadData.js` script to read that file and build a list of users to
email into an `nedb` file.

    node loadData.js

## Send the emails

Some things to note about SparkPost.

* SparkPost limit free accounts to ~~20k sends per day~~. Update: https://www.sparkpost.com/blog/updated-service-plans/
* As of March 2017 we send about 200 messages per day
* If we hit the limit, all emails get rejected not queued
* This script should aim to send max 15k emails per 24h period
* That equals about 1 email every 6s, or 10 per minute

Set the SparkPost API key into the `SPARKPOST_API_KEY` environment variable.

General points to remember.

* The sending will take ~40 hours to send 25k messages
* The script might die during it's run
* Any SparkPost error will permanently stop the run

Start the run like so:

    node sendMassEmail.js
