import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const repoUrl = "https://github.com/your-username/your-repo.git"; // Replace with your repo URL
const tempDir = path.join(__dirname, "temp");
const targetDir = "path/to/directory"; // Relative path in the repo
const documentsDir = path.join(__dirname, "documents");
const gqlRegex = /gql`([\s\S]*?)`/g;

const execAsync = promisify(exec);

async function cloneRepo() {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  await execAsync(`git clone ${repoUrl} ${tempDir}`);
}

function findTSFiles(dir: string): string[] {
  let filesToProcess: string[] = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      filesToProcess = filesToProcess.concat(findTSFiles(fullPath));
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      filesToProcess.push(fullPath);
    }
  }

  return filesToProcess;
}

async function processFiles() {
  const fullPath = path.join(tempDir, targetDir);
  const tsFiles = findTSFiles(fullPath);

  for (const file of tsFiles) {
    const fileContent = fs.readFileSync(file, "utf-8");
    let match;
    while ((match = gqlRegex.exec(fileContent)) !== null) {
      const gqlContent = match[1];
      const hash = crypto.createHash("md5").update(gqlContent).digest("hex");
      const graphqlFilePath = path.join(documentsDir, `${hash}.graphql`);

      fs.writeFileSync(graphqlFilePath, gqlContent);
    }
  }
}

async function prepareDocumentsDir() {
  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir);
  } else {
    fs.readdirSync(documentsDir).forEach((file) => {
      fs.unlinkSync(path.join(documentsDir, file));
    });
  }
}

async function main() {
  await prepareDocumentsDir();
  await cloneRepo();
  await processFiles();

  console.log("GraphQL queries have been extracted and saved.");
}

main().catch(console.error);
