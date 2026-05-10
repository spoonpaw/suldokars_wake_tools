#!/usr/bin/env node
// Print an unused TCP port. Used by the .command launchers to pick a
// port at launch so multiple Tauri apps can dev side-by-side without
// stomping on each other's devUrl.
const net = require('net');
const srv = net.createServer();
srv.listen(0, () => {
  const port = srv.address().port;
  srv.close(() => process.stdout.write(String(port)));
});
