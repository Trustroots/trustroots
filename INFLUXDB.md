# InfluxDB Statistics

So you enabled [InfluxDB](https://www.influxdata.com/time-series-platform/influxdb/) statistics. Hopefully you run version 1.0+. If not, stop now and upgrade.

Here you can read what data are collected and what queries you can run.

## See the data

You can use InfluxDB admin panel or install [Grafana](http://grafana.org/)

### Admin panel

When `influxd` or influx service is running, open [localhost:8083](http://localhost:8083)

### Grafana

By default Grafana runs on port 3000. In order to solve the conflict with trustroots application you need to change the default port in configuration.

- [locate your grafana configuration file](http://docs.grafana.org/installation/configuration/#config-file-locations)
- find, uncomment and change `http_port` value according to your preference
- save the changes and start/restart the grafana server (i.e. `systemctl start grafana`, it is system specific)
- run the client on localhost:(your-value)
- there may be a dashboard available for import (TODO)

## Metrics

[Read more about how to query InfluxDB.](https://docs.influxdata.com/influxdb/v1.0/query_language/) Browse Query Language in Content to see more chapters.

### Messages

These are the data stored for every message in InfluxDB

```js
measurement: 'messageSent'
time

fields: {
  messageId: string,
  idFrom: string,
  idTo: string,
  messageLength: number, // counting only plainText of the message content
  replyTime: number [ms], // field time between the first message and the first reply
                          // available only for "position"='first_reply', otherwise -1
}

tags: {
  messageLengthType: string, // (short|long)
  position: string, // (first|first_reply|other) position in the thread
}
```

#### Amounts

How many messages are sent weekly?

```
SELECT COUNT(messageLength) FROM messageSent WHERE time > now() - 100w GROUP BY time(1w)
```

#### Reply rate

How many new threads are started? How many new threads are replied?

```
SELECT COUNT(messageLength) FROM messageSent WHERE time > now() - 100w AND position = 'first' GROUP BY time(1w)
SELECT COUNT(messageLength) FROM messageSent WHERE time > now() - 100w AND position = 'first_reply' GROUP BY time(1w)
```

What is the ratio at given time?

_To be continued..._

#### Reply time

What is the time since the first message till the first reply?

Average reply time may be interesting:

```
SELECT MEAN(replyTime) FROM messageSent WHERE time > now() - 100w AND position='first_reply' GROUP BY time(1w)
```

Median reply time will be influenced less by very long rare reply times.

```
SELECT MEDIAN(replyTime) FROM messageSent WHERE time > now() - 100w AND position='first_reply' GROUP BY time(1w)
```

#### Message length

How frequent are long and short messages?

```
SELECT COUNT(messageLength) FROM messageSent WHERE time > now() - 100w AND messageLengthType='short' GROUP BY time(1w)
SELECT COUNT(messageLength) FROM messageSent WHERE time > now() - 100w AND messageLengthType='long' GROUP BY time(1w)
```

What is the ratio?

_To be continued..._

You can also filter by the position in the thread. You can try to write your own query which will show average and median message length.


### Users

### Offers
