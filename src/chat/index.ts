import { settings } from "@elizaos/core";
import readline from "readline";
import { isAxiosError } from 'axios';

import axios from '../utils/axios.ts';

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

    const response = await axios.post(
      `${apiBase}/chat/completions`,
      {
        model: "Qwen/QwQ-32B-Preview",
        messages: [{
          role: "user",
          content: input
        }],
        temperature: 0.7
      },
      {
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
      }
    );

    if (!response.status || response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.data;
    if (!data) {
      throw new Error('No data received from the API');
    }

    const message = data.choices[0]?.message?.content;
    if (message) {
      console.log(`${agentId}: ${message}`);
    }
  } catch (error) {
    console.error('Chat error:', error);
    if (isAxiosError(error)) {
      console.error('Axios error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
    }
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
