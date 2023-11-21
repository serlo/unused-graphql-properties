import { basename } from 'path'
import { readFileSync, writeFileSync } from 'fs'

main()

function main() {
  const stats = readCoverageStats()
  const html = generateHtml(stats)

  writeFileSync(process.argv[3], html, 'utf8')
}

function readCoverageStats() {
  const fileContent = readFileSync(process.argv[2], 'utf8')

  return JSON.parse(fileContent) as Stats
}

function generateHtml(stats: Stats) {
  const types = Object.values(stats.types)
  types.sort((a, b) => (a.type > b.type ? 1 : a.type == b.type ? 0 : -1))

  return `<!DOCTYPE html>
  <html>
  <head>
    <title>Coverage of GraphQL</title>
    <style type="text/css">
      body {
        font-family: 'Courier New', Courier, monospace;
        background-color: #f9f9f9;
      }

      .not-used {
        color: #E57373;
      }

      .used {
        color: #4CAF50;
      }

      .type-info {
        color: #555;
        font-size: smaller;
      }

      .spoiler {
          margin: 10px;
          border: 1px solid #ddd;
      }

      .spoiler-heading {
          padding: 10px;
          cursor: pointer;
          user-select: none;
      }

      .spoiler-content {
          padding: 10px;
          border-top: 1px solid #ddd;
      }

      .arrow {
        display: inline-block;
      }

      .open > .spoiler-heading > .arrow {
        transform: rotate(90deg);
      }
    </style>
    <script type="text/javascript">
      function toggleSpoiler(element) {
          var parent = element.parentElement;
          var content = element.nextElementSibling;
          if (content.style.display === "block") {
              content.style.display = "none";
              parent.classList.remove("open");
          } else {
              content.style.display = "block";
              parent.classList.add("open");
          }
      }
    </script>
  </head>
  <body>
    ${types.map(generateTypeReport).join('\n')}
  </body>
  </html>`
}

function generateTypeReport(typeStats: TypeStats) {
  return spoiler({
    open: true,
    heading: `
      <span class="${typeStats.hits > 0 ? 'used' : 'not-used'}">
        ${typeStats.type}
        <span class="type-info">
          (${typeStats.hits}x used | ${typeStats.fieldsCountCovered}/${
            typeStats.fieldsCount
          } fields used)
        </span>
      </span>`,
    headingType: 'h3',
    content: Object.entries(typeStats.children)
      .map(([name, stats]) => generateFieldReport(name, stats))
      .join('\n'),
  })
}

function generateFieldReport(name: string, stats: FieldStats) {
  return spoiler({
    heading: `<span class="${stats.hits > 0 ? 'used' : 'not-used'}">
     ${name} (${stats.hits}x)
    </span>`,
    content: `<ul>
      ${Object.keys(stats.locations)
        .map((x) => basename(x))
        .map((x) => x.replace(/---/g, '/'))
        .map((x) => `<li>${x}</li>`)
        .join('\n')}
    </ul>`,
  })
}

function spoiler({
  content,
  open = false,
  heading,
  headingType = 'div',
}: {
  open?: boolean
  heading: string
  content: string
  headingType?: 'h3' | 'div'
}) {
  return `<div class="spoiler ${open ? 'open' : ''}">
            <${headingType} class="spoiler-heading" onclick="toggleSpoiler(this)">
              <span class="arrow">&#9654;</span>
              ${heading}
            </${headingType}>
            <div class="spoiler-content" style="display: ${
              open ? 'block' : 'none'
            }">
              ${content}
            </div>
        </div>`
}

interface Stats {
  types: Record<string, TypeStats>
}

interface TypeStats {
  hits: number
  fieldsCount: number
  fieldsCountCovered: number
  type: string
  children: Record<string, FieldStats>
}

interface FieldStats {
  hits: number
  locations: Record<string, unknown>
}
