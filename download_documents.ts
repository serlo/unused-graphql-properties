import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const repoUrl = 'https://github.com/serlo/frontend.git'
const tempDir = path.join(os.tmpdir(), 'serlo-frontend')
const documentsDir = path.join(__dirname, 'documents')
const gqlRegex = /gql`([\s\S]*?)`/g

const execAsync = promisify(exec)

main().catch(console.error)

async function main() {
  await prepareDocumentsDir()
  await cloneRepo()
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

async function processFiles() {
  const tsFiles = findTSFiles(tempDir)

  for (const file of tsFiles) {
    const fileContent = fs.readFileSync(file, 'utf-8')
    let match
    while ((match = gqlRegex.exec(fileContent)) !== null) {
      const gqlContent = match[1]
      const hash = crypto.createHash('md5').update(gqlContent).digest('hex')
      const graphqlFilePath = path.join(documentsDir, `${hash}.graphql`)

      fs.writeFileSync(graphqlFilePath, gqlContent)
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

async function cloneRepo() {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  await execAsync(`git clone ${repoUrl} ${tempDir}`)
}
