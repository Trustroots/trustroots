## Application monitoring
Mainly done with [New Relic](http://newrelic.com/application-monitoring) as SaaS. It's [free](http://newrelic.com/application-monitoring/pricing) with 24hr Data Retention. Trustroots simply has npm package included and some config files for this. [See the commit.](https://github.com/Trustroots/trustroots/commit/86c734278760f09fb62881c897b03b336642cef0)

You can also inspect [Passenger's](https://www.phusionpassenger.com/) status with [`passenger-status`](https://www.phusionpassenger.com/documentation/Users%20guide%20Nginx.html#_inspecting_phusion_passenger_8217_s_internal_status) and [`passenger-memory-stats`](https://www.phusionpassenger.com/documentation/Users%20guide%20Nginx.html#_inspecting_memory_usage).

## Server monitoring
#### New Relic
* [New Relic](http://newrelic.com/server-monitoring) SaaS
* It's for free
* See [configuring](https://rpm.newrelic.com/accounts/822478/servers/get_started#platform=debian)
* See: <https://github.com/Trustroots/trustroots/issues/33>

#### PaperTrail
* For syslog and Nginx error log.
* [PaperTrailapp.com](https://papertrailapp.com/dashboard)

## Visitor count/flow
* See: <https://github.com/Trustroots/trustroots/issues/9>

## Emails
* See [Mandrill](https://mandrillapp.com/) dashboard

## Uptime
* Free [pingdom](https://www.pingdom.com/free/) account monitoring www.trustroots.org, will send emails if server is down.
* Public status page at [status.trustroots.org](http://status.trustroots.org/)
* WP's Jetpack is monitoring ideas.trustroots.org (blog)

## Watchdog

* [Monit](http://mmonit.com/monit/) should be running everywhere (currently nope)