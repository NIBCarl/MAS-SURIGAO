#!/usr/bin/env node
/**
 * Security Audit Script
 * Checks for common security vulnerabilities
 */

const fs = require('fs');
const path = require('path');

const issues = [];

// Recursive file scanner
function scanDirectory(dir, extensions) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and other common dirs
      if (['node_modules', '.next', 'dist', '.git', 'scripts'].includes(item)) continue;
      files.push(...scanDirectory(fullPath, extensions));
    } else if (extensions.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = path.relative(process.cwd(), filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comment lines and test patterns
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
    
    // Check for service role key
    if (/SUPABASE_SERVICE_ROLE_KEY|service_role_key/i.test(line) && 
        !line.includes('process.env') && 
        !line.includes('your_') &&
        !line.includes('placeholder') &&
        !line.includes('skip_')) {
      issues.push({
        file: relativePath,
        line: lineNum,
        type: 'CRITICAL',
        message: 'Potential service role key exposure',
        suggestion: 'Never hardcode service role key. Use environment variables.',
      });
    }

    // Check for console logs with sensitive data
    if (/console\.(log|warn|error)\s*\([^)]*(password|token|secret|key)/i.test(line)) {
      issues.push({
        file: relativePath,
        line: lineNum,
        type: 'HIGH',
        message: 'Sensitive data may be logged',
        suggestion: 'Remove console logs containing sensitive data.',
      });
    }

    // Check for dangerouslySetInnerHTML
    if (/dangerouslySetInnerHTML|innerHTML\s*=/i.test(line)) {
      issues.push({
        file: relativePath,
        line: lineNum,
        type: 'MEDIUM',
        message: 'Potential XSS vulnerability',
        suggestion: 'Sanitize HTML content or avoid dangerouslySetInnerHTML.',
      });
    }

    // Check for eval
    if (/\beval\s*\(|new Function\s*\(/i.test(line)) {
      issues.push({
        file: relativePath,
        line: lineNum,
        type: 'MEDIUM',
        message: 'Eval or Function constructor used',
        suggestion: 'Avoid eval(). Use safer alternatives.',
      });
    }

    // Check for hardcoded passwords (basic pattern)
    if (/password\s*[:=]\s*["'][^"']{4,}["']/i.test(line) && 
        !line.includes('//') &&
        !line.includes('process.env')) {
      issues.push({
        file: relativePath,
        line: lineNum,
        type: 'HIGH',
        message: 'Potential hardcoded password',
        suggestion: 'Use environment variables for secrets.',
      });
    }
  }
}

function checkEnvFiles() {
  const envFiles = ['.env', '.env.local', '.env.production'];
  
  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      
      // Check for service role key
      if (content.includes('SUPABASE_SERVICE_ROLE_KEY') && 
          !content.includes('your_') &&
          !content.includes('placeholder')) {
        issues.push({
          file: envFile,
          line: 0,
          type: 'CRITICAL',
          message: 'Service role key found in environment file',
          suggestion: 'Ensure .env files are in .gitignore and never committed.',
        });
      }
    }
  }
}

function checkGitIgnore() {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    issues.push({
      file: '.gitignore',
      line: 0,
      type: 'CRITICAL',
      message: '.gitignore file not found',
      suggestion: 'Create .gitignore and add .env files immediately.',
    });
    return;
  }

  const content = fs.readFileSync(gitignorePath, 'utf-8');
  const requiredPatterns = ['.env', '.env*'];
  
  for (const pattern of requiredPatterns) {
    if (!content.includes(pattern) && !(pattern === '.env' && content.includes('.env*'))) {
      issues.push({
        file: '.gitignore',
        line: 0,
        type: 'HIGH',
        message: `${pattern} not in .gitignore`,
        suggestion: `Add ${pattern} to .gitignore to prevent committing secrets.`,
      });
    }
  }
}

function checkRLS() {
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.log('⚠️  No schema.sql found, skipping RLS check');
    return;
  }

  const content = fs.readFileSync(schemaPath, 'utf-8');
  
  // Check for tables
  const tableMatches = content.match(/CREATE TABLE IF NOT EXISTS (\w+)/g) || [];
  const rlsMatches = content.match(/ALTER TABLE \w+ ENABLE ROW LEVEL SECURITY/g) || [];
  
  const tables = tableMatches.map(m => m.replace('CREATE TABLE IF NOT EXISTS ', ''));
  const rlsTables = rlsMatches.map(m => m.replace('ALTER TABLE ', '').replace(' ENABLE ROW LEVEL SECURITY', ''));
  
  for (const table of tables) {
    if (!rlsTables.includes(table)) {
      issues.push({
        file: 'supabase/schema.sql',
        line: 0,
        type: 'CRITICAL',
        message: `Table "${table}" missing RLS`,
        suggestion: `Add: ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
      });
    }
  }
}

function main() {
  console.log('🔒 Running Security Audit...\n');

  // Scan source files
  const sourceFiles = scanDirectory(process.cwd(), ['.ts', '.tsx', '.js', '.jsx']);
  
  for (const file of sourceFiles) {
    try {
      scanFile(file);
    } catch (err) {
      // Skip files that can't be read
    }
  }

  // Check environment files
  checkEnvFiles();

  // Check .gitignore
  checkGitIgnore();

  // Check RLS
  checkRLS();

  // Report results
  const critical = issues.filter(i => i.type === 'CRITICAL');
  const high = issues.filter(i => i.type === 'HIGH');
  const medium = issues.filter(i => i.type === 'MEDIUM');
  const low = issues.filter(i => i.type === 'LOW');

  console.log(`Found ${issues.length} security issues:\n`);
  console.log(`  🔴 Critical: ${critical.length}`);
  console.log(`  🟠 High: ${high.length}`);
  console.log(`  🟡 Medium: ${medium.length}`);
  console.log(`  🟢 Low: ${low.length}\n`);

  // Sort by severity
  const sorted = [...critical, ...high, ...medium, ...low];

  for (const issue of sorted) {
    const icon = issue.type === 'CRITICAL' ? '🔴' : 
                 issue.type === 'HIGH' ? '🟠' : 
                 issue.type === 'MEDIUM' ? '🟡' : '🟢';
    
    console.log(`${icon} [${issue.type}] ${issue.message}`);
    console.log(`   File: ${issue.file}:${issue.line}`);
    console.log(`   Suggestion: ${issue.suggestion}\n`);
  }

  if (critical.length > 0) {
    console.log('❌ Critical issues found! Fix before deploying.\n');
    process.exit(1);
  } else if (high.length > 0) {
    console.log('⚠️  High severity issues found. Address soon.\n');
    process.exit(0);
  } else {
    console.log('✅ No critical security issues found!\n');
    process.exit(0);
  }
}

main();
