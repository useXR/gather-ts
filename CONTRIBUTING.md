# Contributing to gather-ts

We love your input! We want to make contributing to gather-ts as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with Github
We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## Pull Requests Process

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any contributions you make will be under the MIT Software License
In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using Github's [issue tracker](https://github.com/usexr/gather-ts/issues)
We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/usexr/gather-ts/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can.
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Development Process

1. Clone the repository:
```bash
git clone https://github.com/usexr/gather-ts.git
```

2. Install dependencies:
```bash
npm install
```

3. Run tests:
```bash
npm test
```

4. Make your changes and add/update tests as needed.

5. Run the linter:
```bash
npm run lint
```

6. Build the project:
```bash
npm run build
```

## Testing

We use Jest for testing. To run tests:

```bash
npm test
```

For test coverage:

```bash
npm run test:coverage
```

## Coding Style

- We use TypeScript
- We use ESLint for linting
- We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification
- Write clear, readable code with meaningful variable names
- Comment complex logic, but prefer self-documenting code
- Keep functions small and focused

## Documentation

- Update the README.md if needed
- Add JSDoc comments for new functions and classes
- Update CHANGELOG.md with your changes
- Keep documentation up to date with code changes

## License
By contributing, you agree that your contributions will be licensed under its MIT License.