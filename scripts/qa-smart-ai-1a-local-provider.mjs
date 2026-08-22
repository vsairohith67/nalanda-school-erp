import { createServer } from "node:http";

const port = 3110;
const maximumRequestBytes = 64_000;

function send(response, status, body, contentType = "application/json") {
  response.writeHead(status, {
    "cache-control": "no-store, private",
    "content-type": contentType
  });
  response.end(body);
}

const server = createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/generate") {
    send(response, 404, JSON.stringify({ error: "Not found" }));
    return;
  }

  let size = 0;
  let body = "";
  request.on("data", (chunk) => {
    size += chunk.length;
    if (size <= maximumRequestBytes) body += chunk.toString("utf8");
  });
  request.on("end", () => {
    if (size > maximumRequestBytes) {
      send(response, 413, JSON.stringify({ error: "Request too large" }));
      return;
    }
    let input;
    try {
      input = JSON.parse(body);
    } catch {
      send(response, 400, JSON.stringify({ error: "Invalid JSON" }));
      return;
    }
    const question = typeof input?.question === "string" ? input.question : "";
    const citation = Array.isArray(input?.sources) && typeof input.sources[0]?.id === "string" ? input.sources[0].id : null;
    if (question.includes("SMARTAIMALFORMED")) {
      send(response, 200, "not-json");
      return;
    }
    if (question.includes("SMARTAITIMEOUT")) {
      setTimeout(() => send(response, 200, JSON.stringify({ answer: "Late synthetic answer", citations: citation ? [citation] : [] })), 3_000);
      return;
    }
    if (question.includes("SMARTAIINVALIDCITATION")) {
      send(response, 200, JSON.stringify({ answer: "Untrusted citation output", citations: ["SRC-999"] }));
      return;
    }
    if (question.includes("SMARTAIMALICIOUS")) {
      send(response, 200, JSON.stringify({
        answer: '<script>alert("x")</script><iframe src="https://evil.example"></iframe><svg onload="alert(1)"></svg><a href="javascript:alert(1)">unsafe</a> Synthetic evidence remains plain text.',
        citations: citation ? [citation] : []
      }));
      return;
    }
    if (question.includes("SMARTAILONG")) {
      const paragraph = "Synthetic grounded explanation remains bounded, read-only and supported by the cited task. ";
      send(response, 200, JSON.stringify({ answer: paragraph.repeat(55).trim(), citations: citation ? [citation] : [] }));
      return;
    }
    const title = Array.isArray(input?.sources) && typeof input.sources[0]?.title === "string" ? input.sources[0].title : "the authorised result";
    send(response, 200, JSON.stringify({ answer: `The authorised Universal Search evidence includes ${title}.`, citations: citation ? [citation] : [] }));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ result: "SMARTAI1A_LOCAL_MOCK_READY", host: "127.0.0.1", port }));
});
