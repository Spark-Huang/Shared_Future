import { settings } from "@elizaos/core";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on("SIGINT", () => {
  rl.close();
  process.exit(0);
});

async function handleUserInput(input: string, agentId: string) {
  if (input.toLowerCase() === "exit") {
    rl.close();
    process.exit(0);
  }

  try {
    const apiBase = process.env.OPENAI_API_BASE;

    const response = await fetch(
      `${apiBase}/chat/completions`,
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: input
          }],
          temperature: 0.7
        }),
      }
    );

    const data = await response.json();
    const message = data.choices[0]?.message?.content;
    if (message) {
      console.log(`${agentId}: ${message}`);
    }
  } catch (error) {
    console.error("Error fetching response:", error);
  }
}

export function startChat(characters: Array<{ name: string }>) {
  function chat() {
    const agentId = characters[0]?.name ?? "Agent";
    rl.question("You: ", async (input) => {
      await handleUserInput(input, agentId);
      if (input.toLowerCase() !== "exit") {
        chat(); // Loop back to ask another question
      }
    });
  }

  return chat;
}
