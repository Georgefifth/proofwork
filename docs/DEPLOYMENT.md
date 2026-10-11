# GitHub Pages deployment

Proofwork's browser workspace is static. PDF rendering, table parsing and checks run on the user's device; optional drafts use same-origin IndexedDB and contain extraction text/checks, never PDFs. GitHub Pages provides no backend, OCR service, shared database or CI execution endpoint. The CLI runs separately in a local shell or CI.

The app uses a relative Vite base and BASE_URL for its sample PDF, supporting project Pages subpaths. The Pages action validates tests/build before publishing dist. Pull requests only build/test. Official workflow reference: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## Repository isolation and authentication

The product has its own local Git repository. The unrelated ancestor repository was not reused or modified. The first sandboxed authentication check falsely reported an invalid token because network access was restricted; a network-enabled `gh auth status` confirmed the existing account was authenticated. Existing product repository lookup returned no matching repository. Publication status and actual deployment verification are recorded below after completion.

## Publish preflight

Only product source/docs, synthetic example PDF and synthetic project JSON should be staged. node_modules, dist, .env*, credentials, temporary fixtures and local deployment outputs are ignored. Search staged text for private key blocks, token formats and private data; manually inspect file inventory and documentation. Do not stage the ancestor checkout or home directory.
