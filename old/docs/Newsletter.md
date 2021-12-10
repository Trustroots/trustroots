# Newsletter

Occasionally we send a newsletter to our members.

## Sending newsletter

### Creating campaign

Create campaign on MailPoet. It's the plugin we use for sending newsletters.

It's accessible with same account and URL as our blog:

- [Login](https://ideas.trustroots.org/wp-admin/)
- [MailPoet admin](https://ideas.trustroots.org/wp-admin/admin.php?page=mailpoet-newsletters)

If you don't have an account yet, create one at [wordpress.com/start/account](https://wordpress.com/start/account) and ask someone to add you to the site.

### Updating subscribers

MailPoet's subscribers and subscribers on the actual site's database are not synchronised automatically. Therefore you need to manually update the list each time you want to send out a campaign.

Go to Trustroots admin panel to [export list of newsletter subscribers](https://www.trustroots.org/admin/newsletter) as a CSV file.

Go to importing tool in MailPoet ([_MailPoet → Subscribers → Import_](https://ideas.trustroots.org/wp-admin/admin.php?page=mailpoet-import)) and create a new import with the file. It doesn't matter if the CSV file has some existing emails — MailPoet's import will ignore those.

Remember to delete both files after you don't need them anymore. Especially the local one.

### "From" email

You have a couple options for "from" email. You can override defaults for each campaign in MailPoet separately.

If you use our `support@` address, people's replies go to our support tool, for the support team to read.

If you would prefer other folks in your team to read replies, use `share@` email as sender. There's a list of emails at [Zoho's email admin](https://mailadmin.zoho.com/) panel to whom this email gets forwarded.

Note that we typically get a dozen or so "out of office" auto-replies, so it shouldn't get too noisy. You can also create filters for yourself to funnel all newsletter related emails to a separate folder.

If you don't want replies to newsletter, use `no-reply@` address.

### Rollout

Test the campaign first by sending it to a small, internal test list. Once that works out, do the full-rollout on the main list.

Sending emails is throttled across long enough time. That's so that email providers like Gmail don't flag us for spam when they see a sudden surge of mass email coming out from our servers. Therefore it can take little while before the whole list is processed. Our throttle is currently (2020/12) 100 emails per 5 minutes (that's 28,800 emails per day). This can be adjusted from _Settings → Send With… → Configure_. [Read more about sender reputation](https://www.sparkpost.com/resources/email-explained/email-sender-reputation/).

### Social media

Consider also creating a blog and social media material from the newsletter.
