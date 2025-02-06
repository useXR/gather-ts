// src/register.ts
import path from 'path';
import moduleAlias from 'module-alias';

// Add path aliases
moduleAlias.addAliases({
  '@': path.join(__dirname, '/')
});