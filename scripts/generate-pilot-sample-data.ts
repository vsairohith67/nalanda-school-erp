import { generatePilotSampleData } from "../lib/pilot-sample-data";

generatePilotSampleData()
  .then(({ studentFile, paymentFile }) => {
    console.log("Pilot sample CSV files created. They were not imported.");
    console.log(studentFile);
    console.log(paymentFile);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
