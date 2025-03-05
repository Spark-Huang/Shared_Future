import { settings,Character } from "@elizaos/core";
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

let conversationHistory: Array<{role: string, content: string}> = [];
let isFirstInteraction = true;

async function handleUserInput(input: string, character: Character) {
  if (input.toLowerCase() === "exit") {
    rl.close();
    process.exit(0);
  }
  try {
    const serverPort = parseInt(settings.SERVER_PORT || "3000");
    const apiBase = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
    console.log("Using API Base:", apiBase);
    
    if (isFirstInteraction) {
      conversationHistory = [{
        role: "system",
        content: character.system
      }];
      isFirstInteraction = false;
    }
    
    conversationHistory.push({
      role: "user",
      content: input
    });

    const response = await axios.post(
      `${apiBase}/chat/completions`,
      {
        model: "Qwen/QwQ-32B-Preview",
        messages: conversationHistory,
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

    const data = response.data;
    if (!data) {
      throw new Error('No data received from the API');
    }

    try {
      if (data.choices && data.choices[0]) {
        const assistantMessage = data.choices[0].message;
        conversationHistory.push(assistantMessage);
        console.log(`${character.name}: ${assistantMessage.content}`);
      } else {
        console.error("Unexpected API response format:", data);
      }
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.error("Response data:", data);
    }
  } catch (error) {
    console.error("Error fetching response:", error);
  }
}

export function startChat(characters: Character[]) {
  function chat() {
    // const agentId = characters[0]?.name ?? "Agent";
    rl.question("You: ", async (input) => {
      await handleUserInput(input, characters[0]);
      if (input.toLowerCase() !== "exit") {
        chat(); // Loop back to ask another question
      }
    });
  }

  return chat;
}
