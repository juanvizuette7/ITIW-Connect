const { execSync } = require("child_process");

const ports = [3000, 3001, 3002, 4000];

function killWindowsPort(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .split(/\r?\n/)
      .filter(Boolean);

    const pids = [...new Set(output.map((line) => line.trim().split(/\s+/).pop()).filter(Boolean))];
    pids.forEach((pid) => {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        console.log(`STOPPED port ${port} pid ${pid}`);
      } catch {
        // Ignora procesos ya cerrados.
      }
    });
  } catch {
    console.log(`FREE port ${port}`);
  }
}

function killUnixPort(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .split(/\r?\n/)
      .filter(Boolean);

    output.forEach((pid) => {
      try {
        execSync(`kill -9 ${pid}`, { stdio: "ignore" });
        console.log(`STOPPED port ${port} pid ${pid}`);
      } catch {
        // Ignora procesos ya cerrados.
      }
    });
  } catch {
    console.log(`FREE port ${port}`);
  }
}

const isWindows = process.platform === "win32";
ports.forEach((port) => {
  if (isWindows) {
    killWindowsPort(port);
  } else {
    killUnixPort(port);
  }
});
