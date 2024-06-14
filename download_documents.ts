import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as prettier from 'prettier'
import { exec } from 'child_process'
import { promisify } from 'util'

const repos: Repo[] = [
  { name: 'frontend', branch: 'staging' },
  { name: 'frontend', branch: 'production' },
  { name: 'frontend', branch: 'production' },
  { name: 'frontend', branch: 'meine-mathe-skills' },
  { name: 'cloudflare-worker', branch: 'staging' },
  { name: 'cloudflare-worker', branch: 'production' },
  { name: 'notification-mail-service', branch: 'main' },
  { name: 'quickbar-updater', branch: 'main' },
  { name: 'metadata-exports', branch: 'main' },
]
interface Repo {
  name: string
  branch: string
}
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

async function cloneRepo({ name, branch }: Repo) {
  const repoUrl = `https://github.com/serlo/${name}.git`
  const targetDir = path.join(tempDir, name, branch)

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })

    await execAsync(
      `git clone --depth 1 --single-branch --branch ${branch} ${repoUrl} ${targetDir}`,
    )
  }
}

const namedDocumentsRegex =
  /const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+=\s+gql`([^`]*)`/g
const gqlRegexTs = /(gql|graphql\()`([\s\S]*?)`/g
const gqlRegexPy = /graphql\(\s+"""([\s\S]*?)"""\s+\)/g

async function processFiles() {
  const sourceFiles = findSourceFiles(tempDir)
  const namedDocuments: Record<string, string> = {}
  const documents: Array<{ file: string; document: string }> = []
  let count = 1

  for (const file of sourceFiles) {
    const fileContent = fs.readFileSync(file, 'utf-8')

    let match: ReturnType<typeof namedDocumentsRegex.exec>

    while ((match = namedDocumentsRegex.exec(fileContent)) !== null) {
      namedDocuments[match[1]] = match[2]
    }

    while ((match = gqlRegexTs.exec(fileContent)) !== null) {
      documents.push({ file, document: match[2] })
    }

    while ((match = gqlRegexPy.exec(fileContent)) !== null) {
      documents.push({ file, document: match[1] })
    }
  }

  for (const { file, document } of documents) {
    const fragmentsRegex = /\${([^}]*)}/g

    let newDocument = document

    while (newDocument.match(fragmentsRegex)) {
      newDocument = newDocument.replace(fragmentsRegex, (_, fragment) => {
        if (fragment === 'id') return '42'
        // Fix https://github.com/serlo/frontend/blob/54a1f5dedda0b44fbb7a160426f151d3312ba097/apps/web/src/fetcher/prettify-links-state/ids-query.tsx#L8
        if (fragment === "opts?.withTitle ? 'title' : ''") return 'title'
        return namedDocuments[fragment]
      })

      if (/uuid42:/.exec(newDocument)) {
        newDocument = newDocument.replace('uuid42:', 'query {') + '}'
      }
    }

    // Omit https://github.com/serlo/notification-mail-service/blob/dca922df861996323868b68e4626fca0d0950cba/src/gql/gql.ts#L25
    if (newDocument === 'query GetUser($id: ID!) { user(id: $id) { name } }') {
      continue
    }

    try {
      const gqlContent = await prettier.format(newDocument, {
        parser: 'graphql',
      })
      const filePath = file.replace(os.tmpdir() + '/', '').replace(/\//g, '---')
      const fileName = `${filePath}-${count}.graphql`
      count += 1
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

function findSourceFiles(dir: string): string[] {
  let filesToProcess: string[] = []
  const files = fs.readdirSync(dir)

  for (const file of files) {
    if (file == '__tests__') continue

    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      filesToProcess = filesToProcess.concat(findSourceFiles(fullPath))
    } else if (
      file.endsWith('.ts') ||
      file.endsWith('.tsx') ||
      file.endsWith('.py')
    ) {
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
