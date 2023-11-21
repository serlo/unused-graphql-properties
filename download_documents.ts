import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as prettier from 'prettier'
import { exec } from 'child_process'
import { promisify } from 'util'

const repos = ['frontend', 'cloudflare-worker', 'notification-mail-service']
const tempDir = path.join(os.tmpdir(), 'serlo')
const documentsDir = path.join(__dirname, 'documents')

const execAsync = promisify(exec)

main().catch(console.error)

async function main() {
  await prepareDocumentsDir()
  await cloneRepos()
  await processFiles()

  console.log('GraphQL queries have been extracted and saved.')
}

async function prepareDocumentsDir() {
  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir)
  } else {
    fs.readdirSync(documentsDir).forEach((file) => {
      fs.unlinkSync(path.join(documentsDir, file))
    })
  }
}

async function cloneRepos() {
  for (const repo of repos) {
    await cloneRepo(repo)
  }
}

async function cloneRepo(repo: string) {
  const repoUrl = `https://github.com/serlo/${repo}.git`
  const targetDir = path.join(tempDir, repo)

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })

    await execAsync(`git clone --depth 1 ${repoUrl} ${targetDir}`)
  }
}

const namedDocumentsRegex =
  /const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+=\s+gql`([^`]*)`/g
const gqlRegex = /(gql|query = |graphql\()`([\s\S]*?)`/g

async function processFiles() {
  const tsFiles = findTSFiles(tempDir)
  const namedDocuments: Record<string, string> = {}
  const documents: Array<{ file: string; document: string }> = []

  for (const file of tsFiles) {
    const fileContent = fs.readFileSync(file, 'utf-8')

    let match: ReturnType<typeof namedDocumentsRegex.exec>

    while ((match = namedDocumentsRegex.exec(fileContent)) !== null) {
      namedDocuments[match[1]] = match[2]
    }

    while ((match = gqlRegex.exec(fileContent)) !== null) {
      documents.push({ file, document: match[2] })
    }
  }

  for (const { file, document } of documents) {
    const fragmentsRegex = /\${([a-zA-Z_][a-zA-Z0-9_]*)}/g

    let newDocument = document

    while (newDocument.match(fragmentsRegex)) {
      newDocument = newDocument.replace(fragmentsRegex, (_, fragment) => {
        return fragment === 'id' ? '42' : namedDocuments[fragment]
      })

      if (/uuid42:/.exec(newDocument)) {
        newDocument = newDocument.replace('uuid42:', 'query {') + '}'
      }
    }

    try {
      const gqlContent = await prettier.format(newDocument, {
        parser: 'graphql',
      })
      const filePath = file.replace(os.tmpdir() + '/', '').replace(/\//g, '-')
      const fileName = `${filePath}.graphql`
      const graphqlFilePath = path.join(documentsDir, fileName)

      fs.writeFileSync(graphqlFilePath, gqlContent)
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        printError({
          message: 'SyntaxError',
          file,
          document: newDocument,
          error,
        })
      } else {
        printError({ message: 'Unknwon error', file, error })
      }
    }
  }
}

function findTSFiles(dir: string): string[] {
  let filesToProcess: string[] = []
  const files = fs.readdirSync(dir)

  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      filesToProcess = filesToProcess.concat(findTSFiles(fullPath))
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      filesToProcess.push(fullPath)
    }
  }

  return filesToProcess
}

function printError(
  error: {
    message: string
  } & Record<string, unknown>,
) {
  console.error(JSON.stringify(error, undefined, 2))
}
