process.env.QA23C_PROFILE = "QA23CQA";

async function loadQaHarness() {
  await import("./qa23c-copied-db");
}

void loadQaHarness().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
