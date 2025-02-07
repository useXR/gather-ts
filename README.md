# gather-ts

A powerful code analysis and packaging tool designed for creating AI-friendly code representations. Gather-ts analyzes your codebase, resolves dependencies, and generates a comprehensive single-file representation optimized for AI analysis.

[![npm version](https://badge.fury.io/js/gather-ts.svg)](https://badge.fury.io/js/gather-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 📊 Comprehensive code analysis with dependency resolution
- 🔍 Intelligent file filtering and ignore patterns
- 📝 Token-aware processing with multiple model support
- 🚀 High performance with batch processing and caching
- ⚡️ Support for TypeScript and JavaScript projects
- 🛠️ Configurable output formats
- 📈 Detailed metrics and analytics

## Installation

Install globally:
```bash
npm install -g gather-ts
```

Or as a project dependency:
```bash
npm install --save-dev gather-ts
```

## Quick Start

1. Navigate to your project directory:
```bash
cd your-project
```

2. Generate a default configuration:
```bash
gather-ts --init
```

3. Run the analysis:
```bash
gather-ts src/index.ts --output analysis.txt
```

## Usage

### Basic Command Structure

```bash
gather-ts <files...> --output <output> [options]
```

### Arguments

- `files`: Entry files to analyze (comma or space separated)
- `--output, -o`: Output file path
- `--root, -r`: Project root directory (default: current directory)
- `--depth, -d`: Maximum depth for dependency analysis
- `--debug`: Enable debug logging
- `--batch-size`: Batch size for processing files
- `--metrics`: Include performance metrics in output
- `--config, -c`: Path to custom config file
- `--encoding`: File encoding (default: utf8)
- `--ignore`: Additional patterns to ignore
- `--require`: Required files to include
- `--init`: Initialize configuration in current directory

### Examples

Analyze a single file:
```bash
gather-ts src/app/page.tsx --output output.txt
```

Analyze multiple files with metrics:
```bash
gather-ts src/app/page.tsx,src/components/Button.tsx --output output.txt --metrics
```

Custom configuration and depth:
```bash
gather-ts src/index.ts --output analysis.txt --config custom-config.json --depth 3
```

## Configuration

Gather-ts can be configured using a `gather-ts.config.json` file in your project root. Generate a default configuration using:

```bash
gather-ts --init
```

### Configuration Options

```json
{
  "maxDepth": 5,
  "topFilesCount": 5,
  "showTokenCount": true,
  "tokenizer": {
    "model": "gpt-4",
    "showWarning": true
  },
  "outputFormat": {
    "includeSummaryInFile": true,
    "includeGenerationTime": true,
    "includeUsageGuidelines": true
  },
  "debug": false,
  "cacheTokenCounts": true
}
```

### Configuration Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| maxDepth | number | Maximum depth for dependency analysis | 5 |
| topFilesCount | number | Number of top files to show in summary | 5 |
| showTokenCount | boolean | Show token counts in output | true |
| tokenizer.model | string | Model to use for tokenization | "gpt-4" |
| tokenizer.showWarning | boolean | Show warnings for token limits | true |

## File Ignoring

Gather-ts uses both `.gitignore` and `.gather-ts-ignore` files for determining which files to process. Create a `.gather-ts-ignore` file in your project root to specify additional ignore patterns:

```
# Ignore test files
**/*.test.ts
**/*.spec.ts

# Ignore documentation
docs/
*.md

# Ignore specific directories
temp/
build/
```

## API Usage

You can also use gather-ts programmatically in your Node.js applications:

```typescript
import { configureContainer } from 'gather-ts';

async function analyzeCode() {
  const container = await configureContainer(process.cwd(), {
    debug: true,
    maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    fileExtensions: ['ts', 'tsx', 'js', 'jsx']
  });

  const compiler = container.resolve(ServiceTokens.COMPILER);
  
  const result = await compiler.compile({
    entryFiles: ['src/index.ts'],
    outputFile: 'analysis.txt',
    includeMetrics: true
  });

  console.log(`Analysis complete! Output: ${result.outputPath}`);
}
```

## Error Handling

Gather-ts provides detailed error messages and validation. Common error scenarios:

- Invalid configuration
- File access issues
- Dependency resolution failures
- Token counting errors

Errors include context and suggestions for resolution.

## Performance Tips

1. Use appropriate depth limits for large projects
2. Enable token count caching for faster processing
3. Use batch processing for large file sets
4. Ignore unnecessary files using `.gather-ts-ignore`

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- File a bug report: [GitHub Issues](https://github.com/usexr/gather-ts/issues)
- Feature requests: [GitHub Issues](https://github.com/usexr/gather-ts/issues)
- Questions: [GitHub Discussions](https://github.com/usexr/gather-ts/discussions)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and version history.

## Authors

- **Andrew Robb** - *Initial work*

## Acknowledgments

- Thanks to all contributors
- Built with TypeScript and Node.js
- Inspired by the need for better AI code analysis tools