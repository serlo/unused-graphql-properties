# Coverage of GraphQL endpoints of serlo.org

This package contain helper scripts to show the coverage of GraphQL fields and types of serlo.org.

## Setup

1. Clone repo.
2. Install dependencies via `yarn`.
3. Download GraphQL queries of serlo.org via `yarn download-documents`. The queries are stored in the directory `documents/`.

## Usage

- Use `yarn show-coverage` to show the coverage of GraphQL types and fields in the terminal.
- Use `yarn generate-report` to generate a report about the coverage in `public/index.html`.

## Notice

- In [`download_documents.ts`](./download_documents.ts) in the variable `repos` is defined which repositories are scanned for graphql queries.
- In [`download_documents`](./download_documents.ts) there are also the regexes stored which are used to detect GraphQL statements.
