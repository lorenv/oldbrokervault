import * as ts from 'typescript';
import * as fs from 'fs';

function replaceConsoleWithLogger(sourceFile: ts.SourceFile): string {
  const printer = ts.createPrinter();
  let hasLoggerImport = false;
  
  // Check if logger is already imported
  ts.forEachChild(sourceFile, node => {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === './logger') {
        hasLoggerImport = true;
      }
    }
  });

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      // Replace console.log/error/warn calls
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        if (ts.isPropertyAccessExpression(expression)) {
          const object = expression.expression;
          const property = expression.name;
          
          if (ts.isIdentifier(object) && object.text === 'console') {
            const methodName = property.text;
            let loggerMethod = methodName;
            
            // Map console methods to logger methods
            switch (methodName) {
              case 'log':
                loggerMethod = 'info';
                break;
              case 'error':
                loggerMethod = 'error';
                break;
              case 'warn':
                loggerMethod = 'warn';
                break;
              default:
                return node; // Don't replace other console methods
            }
            
            // Create logger.method call
            const loggerCall = ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier('logger'),
                ts.factory.createIdentifier(loggerMethod)
              ),
              undefined,
              node.arguments
            );
            
            return loggerCall;
          }
        }
      }
      
      return ts.visitEachChild(node, visit, context);
    };
    
    return (node) => ts.visitNode(node, visit) as ts.SourceFile;
  };
  
  const result = ts.transform(sourceFile, [transformer]);
  const transformedSourceFile = result.transformed[0];
  
  // Add import if not present
  if (!hasLoggerImport) {
    // This is simplified - in production you'd want to add the import properly
    return `import { logger } from './logger';\n` + printer.printFile(transformedSourceFile);
  }
  
  return printer.printFile(transformedSourceFile);
}

// Main execution
const filePath = process.argv[2];
if (!filePath) {
  console.error('Please provide a file path');
  process.exit(1);
}

const sourceCode = fs.readFileSync(filePath, 'utf8');
const sourceFile = ts.createSourceFile(
  filePath,
  sourceCode,
  ts.ScriptTarget.Latest,
  true
);

const transformedCode = replaceConsoleWithLogger(sourceFile);
fs.writeFileSync(filePath + '.transformed', transformedCode, 'utf8');
console.log(`Transformed file saved to ${filePath}.transformed`);