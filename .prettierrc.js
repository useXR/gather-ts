// .prettierrc.js
module.exports = {
    semi: true,
    trailingComma: "all",
    singleQuote: false,
    printWidth: 80,
    tabWidth: 2,
    endOfLine: "lf",
    arrowParens: "avoid",
    bracketSpacing: true,
    overrides: [
      {
        files: "*.ts",
        options: {
          parser: "typescript",
        },
      },
    ],
  };