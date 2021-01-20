const URL_SCHEMA = require("./schema/url");
const mongoose = require("mongoose");
const express = require("express");
const cron = require("node-cron");
const cors = require("cors");
const ping = require("ping");
const URL = require("url-parse");

require("dotenv").config();
const PORT = process.env.PORT || 8000;

const MONGODB_CONNECTION_URL = `mongodb+srv://admin:${process.env.MONGOOSE_PASSWORD}@cluster0.v8zj5.mongodb.net/downtime-moniter?retryWrites=true&w=majority`;
mongoose.connect(MONGODB_CONNECTION_URL, {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});
const db = mongoose.connection;

const app = express();
// https://downtime-monitor.web.app
// http://localhost:3000
app.use(
  cors({
    origin: ["http://localhost:3000", "https://downtime-monitor.web.app"],
  })
);
app.use(express.json());

cron.schedule("*/5 * * * *", () => {
  console.log(new Date().toLocaleString());
  URL_SCHEMA.find({}, async (err, urls) => {
    if (err) {
      console.error("Error while reading URLs in cron-job");
      return;
    }

    for (const doc of urls) {
      const { updateInterval, url, statuses, _id } = doc;
      const intervalToPingAfter = updateInterval;
      const currDateTime = Date.now() / (60 * 1000);
      const diff =
        currDateTime - Math.floor(statuses[0].timestamp / (60 * 1000));
      const URLObj = new URL(url);
      console.log(diff);

      if (diff >= intervalToPingAfter) {
        const { alive, time } = await ping.promise.probe(URLObj.hostname, {});
        statuses.unshift({
          alive,
          responseTime: time,
          timestamp: currDateTime * 60 * 1000,
        });

        await URL_SCHEMA.findByIdAndUpdate(_id, {
          ...doc,
          statuses,
        });
      }
    }
  });
});

// app.get("/test", (req, res) => {
//   res.sendStatus(200);
// });

app.get("/urls", (req, res) => {
  URL_SCHEMA.find({}, (err, urls) => {
    if (err) {
      console.error("Error while reading URLs");
      res.sendStatus(500);
    } else {
      res.status(200).json(urls);
    }
  });
});

app.post("/add", async (req, res) => {
  const { url } = req.body;
  // TODO: check if already a part of the db
  const data = {
    url,
    lastModified: Date.now(),
    updateInterval: 30,
    createdAt: Date.now(),
    statuses: [
      { alive: null, responseTime: -1, timestamp: new Date(2019, 1, 1) },
    ],
  };

  URL_SCHEMA.create(data, (err, data) => {
    if (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err,
      });
    } else {
      res.status(201).json({
        success: true,
        id: data.id,
      });
    }
  });
});

app.post("/update-interval", async (req, res) => {
  const { id, interval } = req.body;
  console.log(req.body);
  const data = await URL_SCHEMA.findByIdAndUpdate(id, {
    updateInterval: interval,
  });

  if (!data) {
    console.error(`${id} not found`);
    res.status(404).json({ success: false });
  }
  res.status(202).json({ success: true });
});

app.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const data = await URL_SCHEMA.findByIdAndDelete(id);
  if (!data) {
    console.error(`${id} not found`);
    res.status(404).json({ success: false });
  }
  res.status(200).json({ success: true });
});

app.get("/:id", async (req, res) => {
  const { id } = req.params;
  const data = await URL_SCHEMA.findById(id);

  if (!data) {
    console.error(`${id} not found`);
    res.status(404).json({ success: false });
  } else {
    res.status(200).json({ success: true, data });
  }
});

app.listen(PORT, () => console.log(`listening on ${PORT}`));
