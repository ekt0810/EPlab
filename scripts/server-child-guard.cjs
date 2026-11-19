// Close the frontend if its supervisor disappears; never leave an orphan port.
if (process.send) {
  process.on("disconnect", () => process.exit(1));
  process.on("message", (message) => {
    if (message && message.type === "shutdown") process.exit(0);
  });
}
