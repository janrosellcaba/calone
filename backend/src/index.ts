import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`Calone API listening on ${config.apiUrl} (port ${config.port})`);
});
