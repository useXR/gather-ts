#!/usr/bin/env node
import path from "path";
import moduleAlias from "module-alias";

// Add path aliases
moduleAlias.addAliases({
  "@": path.join(__dirname, "/"),
});

// Export for use in other files
export const register = () => {
  moduleAlias();
};