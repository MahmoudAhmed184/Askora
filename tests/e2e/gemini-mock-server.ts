import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

const host = "127.0.0.1";
const port = 5174;

const questions = {
  english: [
    "What recent idea changed how you approach your work?",
    "Which skill would you most like to strengthen this month?",
    "What small experiment are you excited to try next?",
  ],
  modern_standard_arabic: [
    "ما الفكرة التي غيّرت طريقة تعاملك مع عملك مؤخراً؟",
    "ما المهارة التي ترغب في تطويرها أكثر هذا الشهر؟",
    "ما التجربة الصغيرة التي تتطلع إلى خوضها قريباً؟",
  ],
  egyptian_arabic: [
    "إيه الفكرة اللي غيّرت طريقتك في الشغل مؤخراً؟",
    "إيه المهارة اللي حابب تطورها أكتر الشهر ده؟",
    "إيه التجربة الصغيرة اللي متحمس تعملها قريب؟",
  ],
} as const;

const server = createServer((request, response) => {
  void handleRequest(request, response).catch(() => {
    if (!response.headersSent) {
      sendJson(response, 500, { error: { code: 500 } });
    } else {
      response.end();
    }
  });
});

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const url = new URL(request.url ?? "/", `http://${host}:${String(port)}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && url.pathname.includes("/models/")) {
    sendJson(response, 200, {
      name: url.pathname.slice(url.pathname.indexOf("models/")),
      supportedGenerationMethods: ["generateContent"],
    });
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname.endsWith(":generateContent")
  ) {
    const body = await readRequestBody(request);
    const generated = questions[getPromptLanguage(body)];

    sendJson(response, 200, {
      candidates: [
        {
          content: {
            role: "model",
            parts: [
              {
                text: JSON.stringify({
                  questions: generated.map((text) => ({ text })),
                }),
              },
            ],
          },
          finishReason: "STOP",
        },
      ],
      usageMetadata: {
        promptTokenCount: 40,
        candidatesTokenCount: 24,
        totalTokenCount: 64,
      },
    });
    return;
  }

  sendJson(response, 404, { error: { code: 404 } });
}

server.listen(port, host);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readRequestBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    if (typeof chunk === "string" || chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
    }
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function getPromptLanguage(body: unknown): keyof typeof questions {
  const serialized = JSON.stringify(body);

  if (serialized.includes("modern_standard_arabic")) {
    return "modern_standard_arabic";
  }

  if (serialized.includes("egyptian_arabic")) {
    return "egyptian_arabic";
  }

  return "english";
}
