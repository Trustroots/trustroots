const fs = require("fs");
const storage = require("node-persist");

storage.initSync({
  dir: "state"
});

const json = fs.readFileSync("users.json", { encoding: "utf-8" });
