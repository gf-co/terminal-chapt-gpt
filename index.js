import chalk from "chalk";
import Table from "cli-table3";
import dotenv from "dotenv";
import fs from "fs";
import OpenAI from "openai";
import readline from "readline";


dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const apiKey = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey });

const models = JSON.parse(fs.readFileSync("./models.json", "utf8"));

async function setUpConversation() {
  function askModelQuestion() {
    return new Promise((resolve) => {
      rl.question(chalk.blue("Which model do you want to use? (Enter number)\n"), (answer) => {
        const modelKey = Object.keys(models)[answer - 1];
        const model = models[modelKey];
        if (model) {
          console.log("\n" + chalk.blue("ChatGPT:") + "\n" + chalk.blue("Perfect. You have selected ") + chalk.green(model.name) + ".\n");
          resolve(model);
        } else {
          console.log("\n" + chalk.blue("ChatGPT:") + "\n" + chalk.blue("Invalid choice. Please try again.") + "\n");
          resolve(askModelQuestion());
        }
      });
    });
  }

  function askSystemQuestion() {
    return new Promise((resolve) => {
      rl.question(chalk.blue("How do you want me to respond? Example: You are a helpful assistant.\n\n") + chalk.green("Me:\n"), (answer) => {
        if (answer) {
          console.log("\n" + chalk.blue("ChatGPT:") + "\n" + chalk.blue("All done! I am ready for our conversation. What do you want to talk about?") + "\n");
          resolve(answer);
        } else {
          console.log("\n" + chalk.blue("ChatGPT:") + "\n" + chalk.blue("Invalid choice. Please try again.") + "\n");
          resolve(askSystemQuestion());
        }
      });
    });
  }

  console.log("\n" + chalk.blue("ChatGPT:") + "\n" + chalk.blue("Hi. I'm ChatGPT, let's have a conversation. But first, we need to set up some configurations.") + "\n");

  const table = new Table({
    head: [chalk.red("Index"), chalk.green("Key"), chalk.yellow("Name"), chalk.magenta("Tokens"), chalk.green("Training Data"), chalk.yellow("Description")],
    colWidths: [10, 30, 25, 15, 20, 60],
  });

  Object.entries(models).forEach(([key, model], index) => {
    table.push([index + 1, key, model.name, model.tokens, model.trainingData, model.description]);
  });

  console.log(table.toString() + "\n\n");

  const model = await askModelQuestion();

  const system = await askSystemQuestion();

  startConversation({ model: model.id, system: system });
}

function saveConversation(messages, model, dateCreated) {
  const data = JSON.stringify({ messages, model, dateCreated }, null, 2);
  const directory = "conversations";
  const filename = `${model}-${dateCreated}.json`;
  fs.writeFileSync(`./${directory}/${filename}`, data, { encoding: 'utf8' });
}

async function startConversation({ model, system }) {
  async function getUserInput(messages) {
    return new Promise((resolve) => {
      rl.question(chalk.green("Me:\n"), (answer) => {
        console.log("");
        messages.push({ role: "user", content: answer });
        resolve(messages);
      });
    });
  }

  async function getChatbotResponse(messages, model) {
    console.log(chalk.blue("ChatGPT:"));
    const completion = await openai.chat.completions.create({
      model,
      messages,
      stream: true,
    });

    let assistantMessage = "";
    for await (const chunk of completion) {
      if (chunk.choices[0].delta.content) {
        process.stdout.write(chalk.blue(chunk.choices[0].delta.content));
        assistantMessage += chunk.choices[0].delta.content;
      }
    }

    messages.push({ role: "assistant", content: assistantMessage });
    console.log("\n");
    return messages;
  }

  const dateCreated = new Date().toISOString();

  let messages = [{ role: "system", content: system }];

  while (true) {
    messages = await getUserInput(messages);
    messages = await getChatbotResponse(messages, model);
    saveConversation(messages, model, dateCreated);
  }
}

function main() {
  const setupConfig = setUpConversation();
  startConversation(setupConfig);
}

main();
