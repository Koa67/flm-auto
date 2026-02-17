import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface SecurityIssue {
  file: string;
  line: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  message: string;
  code?: string;
}

interface AuditReport {
  timestamp: string;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  issues: SecurityIssue[];
  npmAudit: any;
}

function getAllFiles(dir: string, extensions: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git'].includes(item)) {
        files.push(...getAllFiles(fullPath, extensions));
      }
    } else if (extensions.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*');
}

function scanForDangerousPatterns(files: string[]): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  
  const patterns = [
    {
      regex: /SUPABASE_SERVICE_ROLE_KEY|service_role/gi,
      severity: 'CRITICAL' as const,
      type: 'Hardcoded Service Role Key',
      message: 'Service role key should never be used in client code'
    },
    {
      regex: /(?:password|secret|api_key|apikey|access_token|private_key)\s*[:=]\s*["'][^"']+["']/gi,
      severity: 'CRITICAL' as const,
      type: 'Hardcoded Credentials',
      message: 'Hardcoded credentials found - use environment variables'
    },
    {
      regex: /\beval\s*\(/gi,
      severity: 'CRITICAL' as const,
      type: 'Unsafe eval()',
      message: 'eval() is dangerous and can execute arbitrary code'
    },
    {
      regex: /new\s+Function\s*\(/gi,
      severity: 'CRITICAL' as const,
      type: 'Unsafe Function constructor',
      message: 'Function constructor can execute arbitrary code'
    },
    {
      regex: /dangerouslySetInnerHTML/gi,
      severity: 'HIGH' as const,
      type: 'dangerouslySetInnerHTML',
      message: 'XSS vulnerability - sanitize input or use safer alternatives'
    },
    {
      regex: /\.innerHTML\s*=/gi,
      severity: 'HIGH' as const,
      type: 'innerHTML assignment',
      message: 'XSS vulnerability - use textContent or safer DOM methods'
    },
    {
      regex: /document\.write\s*\(/gi,
      severity: 'HIGH' as const,
      type: 'document.write',
      message: 'Unsafe and deprecated - can overwrite entire document'
    },
    {
      regex: /http:\/\/(?!localhost|127\.0\.0\.1)/gi,
      severity: 'MEDIUM' as const,
      type: 'Insecure HTTP URL',
      message: 'Use HTTPS for external URLs to prevent MITM attacks'
    }
  ];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const isScriptFile = file.includes('/scripts/');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip comment lines
      if (isCommentLine(line)) continue;

      // Check console.log only for non-script files
      if (!isScriptFile && /console\.log\s*\(/gi.test(line)) {
        issues.push({
          file,
          line: i + 1,
          severity: 'LOW',
          type: 'console.log in production',
          message: 'Remove console.log from production code',
          code: line.trim()
        });
      }

      // Check all other patterns
      for (const pattern of patterns) {
        if (pattern.regex.test(line)) {
          issues.push({
            file,
            line: i + 1,
            severity: pattern.severity,
            type: pattern.type,
            message: pattern.message,
            code: line.trim()
          });
        }
      }
    }
  }

  return issues;
}

function checkSecurityHeaders(configPath: string): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  
  if (!fs.existsSync(configPath)) {
    issues.push({
      file: configPath,
      line: 0,
      severity: 'HIGH',
      type: 'Missing config file',
      message: 'next.config.ts not found'
    });
    return issues;
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  
  const requiredHeaders = [
    { name: 'X-Frame-Options', severity: 'HIGH' as const },
    { name: 'X-Content-Type-Options', severity: 'HIGH' as const },
    { name: 'Content-Security-Policy', severity: 'HIGH' as const },
    { name: 'Strict-Transport-Security', severity: 'MEDIUM' as const },
    { name: 'Referrer-Policy', severity: 'MEDIUM' as const },
    { name: 'Permissions-Policy', severity: 'MEDIUM' as const }
  ];

  for (const header of requiredHeaders) {
    if (!content.includes(header.name)) {
      issues.push({
        file: configPath,
        line: 0,
        severity: header.severity,
        type: 'Missing Security Header',
        message: `${header.name} header not configured`
      });
    }
  }

  return issues;
}

function checkApiRouteSecurity(apiDir: string): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  
  if (!fs.existsSync(apiDir)) return issues;

  const apiFiles = getAllFiles(apiDir, ['.ts', '.tsx']);
  const protectedRoutePatterns = ['/user', '/saved', '/wishlist', '/dashboard'];

  for (const file of apiFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    // Check for protected routes without auth
    const isProtectedRoute = protectedRoutePatterns.some(pattern => 
      file.includes(pattern)
    );
    
    if (isProtectedRoute) {
      const hasAuth = /getUser|getSession/.test(content);
      if (!hasAuth) {
        issues.push({
          file,
          line: 0,
          severity: 'CRITICAL',
          type: 'Missing Authentication',
          message: 'Protected route does not check authentication'
        });
      }
    }

    // Check for JSON parsing without validation
    const hasJsonParsing = /request\.json\(\)|req\.json\(\)/.test(content);
    const hasValidation = /zod|yup|joi|validate|schema/i.test(content);
    
    if (hasJsonParsing && !hasValidation) {
      for (let i = 0; i < lines.length; i++) {
        if (/request\.json\(\)|req\.json\(\)/.test(lines[i])) {
          issues.push({
            file,
            line: i + 1,
            severity: 'MEDIUM',
            type: 'Missing Input Validation',
            message: 'API route accepts JSON without validation',
            code: lines[i].trim()
          });
          break;
        }
      }
    }
  }

  return issues;
}

function runNpmAudit(): any {
  try {
    const result = execSync('npm audit --json', { 
      encoding: 'utf-8',
      cwd: '/Users/koa/Dev/flm-auto'
    });
    return JSON.parse(result);
  } catch (error: any) {
    // npm audit exits with non-zero if vulnerabilities found
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout);
      } catch {
        return { error: 'Failed to parse npm audit output' };
      }
    }
    return { error: error.message };
  }
}

function printReport(report: AuditReport) {
  console.log('\n' + '='.repeat(80));
  console.log('🔒 SECURITY AUDIT REPORT');
  console.log('='.repeat(80));
  console.log(`Timestamp: ${report.timestamp}\n`);

  console.log('📊 SUMMARY');
  console.log('-'.repeat(80));
  console.log(`🔴 CRITICAL: ${report.summary.critical}`);
  console.log(`🟠 HIGH:     ${report.summary.high}`);
  console.log(`🟡 MEDIUM:   ${report.summary.medium}`);
  console.log(`🟢 LOW:      ${report.summary.low}`);
  console.log(`📌 TOTAL:    ${report.summary.total}\n`);

  const severities: Array<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const icons = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' };

  for (const severity of severities) {
    const severityIssues = report.issues.filter(i => i.severity === severity);
    if (severityIssues.length === 0) continue;

    console.log(`\n${icons[severity]} ${severity} (${severityIssues.length})`);
    console.log('='.repeat(80));

    for (const issue of severityIssues) {
      const relativePath = issue.file.replace('/Users/koa/Dev/flm-auto/', '');
      console.log(`\n📁 ${relativePath}${issue.line > 0 ? `:${issue.line}` : ''}`);
      console.log(`   Type: ${issue.type}`);
      console.log(`   Message: ${issue.message}`);
      if (issue.code) {
        console.log(`   Code: ${issue.code.substring(0, 100)}${issue.code.length > 100 ? '...' : ''}`);
      }
    }
  }

  // NPM Audit Summary
  console.log('\n\n📦 NPM AUDIT');
  console.log('='.repeat(80));
  if (report.npmAudit.error) {
    console.log(`❌ Error: ${report.npmAudit.error}`);
  } else if (report.npmAudit.metadata) {
    const meta = report.npmAudit.metadata.vulnerabilities;
    console.log(`Total vulnerabilities: ${meta.total || 0}`);
    console.log(`  Critical: ${meta.critical || 0}`);
    console.log(`  High: ${meta.high || 0}`);
    console.log(`  Moderate: ${meta.moderate || 0}`);
    console.log(`  Low: ${meta.low || 0}`);
    console.log(`  Info: ${meta.info || 0}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Audit complete');
  console.log('='.repeat(80) + '\n');
}

async function main() {
  console.log('🔍 Starting security audit...\n');

  const baseDir = '/Users/koa/Dev/flm-auto';
  const srcDir = path.join(baseDir, 'src');
  const configPath = path.join(baseDir, 'next.config.ts');
  const apiDir = path.join(srcDir, 'app', 'api');

  const allIssues: SecurityIssue[] = [];

  // Scan source files
  console.log('📂 Scanning source files...');
  const srcFiles = getAllFiles(srcDir, ['.ts', '.tsx']);
  allIssues.push(...scanForDangerousPatterns(srcFiles));

  // Check security headers
  console.log('🛡️  Checking security headers...');
  allIssues.push(...checkSecurityHeaders(configPath));

  // Check API routes
  console.log('🔐 Checking API route security...');
  allIssues.push(...checkApiRouteSecurity(apiDir));

  // Run npm audit
  console.log('📦 Running npm audit...');
  const npmAudit = runNpmAudit();

  // Build report
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    summary: {
      critical: allIssues.filter(i => i.severity === 'CRITICAL').length,
      high: allIssues.filter(i => i.severity === 'HIGH').length,
      medium: allIssues.filter(i => i.severity === 'MEDIUM').length,
      low: allIssues.filter(i => i.severity === 'LOW').length,
      total: allIssues.length
    },
    issues: allIssues,
    npmAudit
  };

  // Print report
  printReport(report);

  // Save to file
  const reportPath = path.join(baseDir, 'data', 'security-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: ${reportPath}\n`);

  // Exit with error code if critical issues found
  if (report.summary.critical > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
