# Contributing

Thanks for taking the time to contribute to DotReport.

The project is intentionally configuration driven and lightweight. Please keep changes focused, easy to review, and consistent with the existing codebase.

## Before opening a pull request

If you are planning a larger feature or a change that affects the public API, open an issue first so the approach can be discussed.

For bug fixes, documentation improvements, and small enhancements, feel free to open a pull request directly.

## Development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Create a `.env.local` from `.env.example` before running the project. At minimum, you will need valid Bungie and Last.fm API credentials.

Most user-facing changes can be tested locally at `http://localhost:3000`.

## Project layout

A few files handle most day to day development:

| File              | Purpose                                    |
| ----------------- | ------------------------------------------ |
| `config/site.ts`  | Defines the page layout and section order. |
| `lib/sections.ts` | Defines the available section types.       |
| `app/components/` | Individual UI components.                  |
| `app/globals.css` | Global styling.                            |
| `lib/bungie.ts`   | Bungie API integration.                    |
| `lib/lastfm.ts`   | Last.fm API integration.                   |

If you add a new section type, remember to update both `lib/sections.ts` and `app/components/Section.tsx`.

## Style guidelines

Please follow the existing style throughout the repository.

* Keep components small and focused.
* Prefer server components unless client functionality is required.
* Avoid adding client-side JavaScript unless there is a clear need.
* Keep configuration inside `config/site.ts` instead of hardcoding values.
* Preserve TypeScript type safety instead of bypassing it with `any`.

## Documentation

If your change affects configuration, environment variables, or the available section types, update the README alongside your code.

Examples are encouraged when introducing new configuration options.

## Pull requests

Before submitting a pull request, make sure that:

* The project builds successfully.
* Your changes work with the existing configuration system.
* Documentation has been updated if needed.
* The scope of the pull request is limited to a single feature or fix.

Clear commit messages and concise pull request descriptions make reviews much easier.

## Reporting issues

When opening an issue, include:

* A description of the problem.
* Steps to reproduce it.
* Expected behavior.
* Actual behavior.
* Relevant environment details, such as your Node version and any error output.

If the issue involves Bungie or Last.fm data, include enough information to reproduce the problem without sharing API keys or other secrets.

## License

By submitting a contribution, you agree that your work will be licensed under the same license as this project.
