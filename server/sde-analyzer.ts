import { objectStorage } from './object-storage';
import { db } from './db';
import { sdeAnalyses } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from './logger';
import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import OpenAI from 'openai';
import XLSX from 'xlsx';
import { promises as fsPromises } from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const unlinkAsync = promisify(fs.unlink);
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

const PYTHON_SCRIPT_PATH = path.join(__dirname, 'sde-analyzer-package', 'sde_analyzer.py');

// Find python3 executable path at startup
let PYTHON_PATH = 'python3';
try {
  // Try to get the full path to python3 using 'which'
  const pythonPath = execSync('which python3', { encoding: 'utf8' }).trim();
  if (pythonPath) {
    PYTHON_PATH = pythonPath;
    logger.info(`Found python3 at: ${PYTHON_PATH}`);
  }
} catch (error) {
  logger.warn('Could not find python3 using which, will try using PATH at runtime');
}

/**
 * Helper: Store file with fallback to filesystem if App Storage unavailable
 */
async function storeFile(storagePath: string, buffer: Buffer): Promise<{ success: boolean; useFilesystem: boolean; path: string }> {
  // Try App Storage first
  try {
    await objectStorage.uploadBuffer(storagePath, buffer);
    return { success: true, useFilesystem: false, path: storagePath };
  } catch (error) {
    logger.warn('App Storage unavailable, falling back to filesystem:', error);

    // Fall back to filesystem
    try {
      const filesystemPath = path.join(process.cwd(), 'storage', 'sde-files', storagePath);
      await fsPromises.mkdir(path.dirname(filesystemPath), { recursive: true });
      await fsPromises.writeFile(filesystemPath, buffer);
      return { success: true, useFilesystem: true, path: storagePath };
    } catch (fsError) {
      logger.error('Failed to store file in filesystem:', fsError);
      throw new Error('Failed to store file');
    }
  }
}

/**
 * Helper: Retrieve file with fallback to filesystem
 */
async function retrieveFile(storagePath: string, useFilesystem: boolean): Promise<Buffer> {
  if (useFilesystem) {
    const filesystemPath = path.join(process.cwd(), 'storage', 'sde-files', storagePath);
    return await fsPromises.readFile(filesystemPath);
  } else {
    return await objectStorage.downloadBuffer(storagePath);
  }
}

// OpenAI client (lazy initialization)
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set - AI-enhanced add-back detection will be skipped');
    return null;
  }

  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    logger.info('OpenAI client initialized');
  }

  return openai;
}

interface AddBack {
  row: number;
  label: string;
  category: string;
}

interface AIAnalysisResult {
  revenue_row: number | null;
  noi_row: number | null;
  addbacks: AddBack[];
}

export class SDEAnalyzerService {
  /**
   * Use AI to analyze P&L and identify revenue, NOI, and add-backs
   * @param filePath Path to Excel file
   * @returns Analysis result with revenue row, NOI row, and add-backs
   */
  async identifyAddBacksWithAI(filePath: string): Promise<AIAnalysisResult> {
    const client = getOpenAIClient();

    if (!client) {
      logger.warn('OPENAI_API_KEY not set - AI analysis will be skipped');
      return { revenue_row: null, noi_row: null, addbacks: [] };
    }

    try {
      logger.info('Starting AI analysis of P&L file');

      // Read Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON (array of arrays)
      const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Take first 200 rows (to avoid token limits)
      const limitedData = data.slice(0, 200);

      // Convert to text representation with better formatting
      const textData = limitedData
        .map((row, idx) => {
          const rowStr = row.map(cell => cell === null || cell === undefined ? '' : String(cell)).join(' | ');
          return `Row ${idx + 1}: ${rowStr}`;
        })
        .join('\n');

      logger.info('Sending P&L data to OpenAI for analysis');

      // Call OpenAI
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a financial analyst expert in analyzing P&L statements and identifying SDE (Seller's Discretionary Earnings) components.

Your tasks:
1. Find the TOTAL REVENUE row (may be labeled as: "Total Income", "Total for Income", "Total Revenue", "Gross Revenue", "Total Sales", "Income Total", etc.)
2. Find the NET OPERATING INCOME row (may be labeled as: "Net Income", "Net Operating Income", "NOI", "Operating Income", "Net Profit", "Bottom Line", etc.)
3. Identify ALL add-back expenses BETWEEN revenue and NOI

SDE Add-backs are expenses that can be added back to calculate true earnings:

**MUST LOOK FOR THESE (even with variations in naming):**
- Depreciation (depreciation expense, deprec, D&A)
- Amortization (amortization expense, amort)
- Officer Compensation (officer comp, officer salary, officer wages, officer payroll)
- Owner Compensation (owner comp, owner salary, owner wages, owner draw, owner payroll)
- Interest Expense (interest paid, interest on debt, loan interest, financing costs)
- Meals & Entertainment (meals, entertainment, M&E, business meals, dining)
- Travel Expenses (travel, business travel, travel costs)
- Auto/Vehicle Expenses (auto expense, vehicle expense, car expense, transportation)
- Payroll Taxes (payroll tax, 941, FUTA, SUTA, employment taxes, employer taxes)
- Legal & Professional Fees (legal fees, attorney, accounting fees, professional services)
- Bonuses (bonus expense, discretionary bonuses)
- Rent to Owner (rent expense, lease expense - if paid to owner)
- One-time Expenses (consulting, restructuring, non-recurring)

**DO NOT INCLUDE:**
- Insurance (regular business insurance, general liability, property insurance - these are normal operating expenses, NOT addbacks)

Return ONLY a JSON object with this EXACT structure:
{
  "revenue_row": <row_number or null>,
  "noi_row": <row_number or null>,
  "addbacks": [
    {"row": <row_number>, "label": "<exact_expense_name_from_file>", "category": "<category>"},
    ...
  ]
}

CRITICAL:
- Use row numbers as they appear in the data (1-based indexing)
- Include the EXACT label text from the file
- Only include expenses BETWEEN revenue and NOI rows
- If you can't find revenue/NOI, set to null
- If no add-backs found, use empty array []`
          },
          {
            role: 'user',
            content: `Analyze this P&L data and identify the revenue row, NOI row, and all SDE add-backs:\n\n${textData}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      let content = response.choices[0]?.message?.content || '{"revenue_row":null,"noi_row":null,"addbacks":[]}';

      // Strip markdown code fences if present
      content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();

      // Parse JSON response
      let result: AIAnalysisResult;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        logger.error('Failed to parse OpenAI response as JSON:', parseError);
        throw new Error('OpenAI returned invalid JSON');
      }

      logger.info(`AI analysis complete: Found ${result.addbacks.length} add-backs`);

      return result;

    } catch (error) {
      logger.error('Error in AI analysis:', error);
      return { revenue_row: null, noi_row: null, addbacks: [] }; // Fall back to Python's built-in detection
    }
  }

  /**
   * Run the Python SDE analyzer script
   * @param inputPath Path to input Excel file
   * @param outputPath Path for output Excel file
   * @param companyName Optional company name
   * @param addBacks Optional AI-identified add-backs
   * @returns Promise that resolves when analysis completes
   */
  async runPythonAnalyzer(
    inputPath: string,
    outputPath: string,
    companyName?: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
      logger.info(`Running Python SDE analyzer: ${inputPath} -> ${outputPath}`);
      logger.info(`Python path: ${PYTHON_PATH}`);
      logger.info(`Script path: ${PYTHON_SCRIPT_PATH}`);

      // Build command arguments - use absolute paths
      const args = [
        PYTHON_SCRIPT_PATH,
        path.resolve(inputPath),
        path.resolve(outputPath)
      ];

      if (companyName) {
        args.push(companyName);
      }

      logger.info(`Spawn arguments: ${JSON.stringify(args)}`);

      // Spawn Python process
      // Use PYTHON_PATH which resolves from environment or defaults to python3
      const pythonProcess = spawn(PYTHON_PATH, args, {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1', // Ensure immediate output
          PATH: process.env.PATH // Explicitly pass PATH environment
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('Python SDE analyzer completed successfully');
          logger.info(`Output: ${stdout}`);
          resolve({ success: true });
        } else {
          logger.error(`Python SDE analyzer failed with code ${code}`);
          logger.error(`stderr: ${stderr}`);
          logger.error(`stdout: ${stdout}`);
          reject(new Error(`SDE analysis failed: ${stderr || 'Unknown error'}`));
        }
      });

      pythonProcess.on('error', (error: any) => {
        logger.error('Failed to start Python process:', error);
        logger.error(`Error code: ${error.code}`);
        logger.error(`Python path used: ${PYTHON_PATH}`);
        logger.error(`Script path: ${PYTHON_SCRIPT_PATH}`);
        logger.error(`Working directory: ${process.cwd()}`);

        if (error.code === 'ENOENT') {
          reject(new Error(`Python executable not found at: ${PYTHON_PATH}. Error: ${error.message}`));
        } else {
          reject(new Error(`Failed to run analysis: ${error.message}`));
        }
      });
    });
  }

  /**
   * Process a single analysis from start to finish
   * @param analysisId Database ID of the analysis to process
   */
  async processAnalysis(analysisId: number): Promise<void> {
    logger.info(`⚙️ processAnalysis called for ID: ${analysisId}`);

    try {
      // Get the analysis record
      const [analysis] = await db.select()
        .from(sdeAnalyses)
        .where(eq(sdeAnalyses.id, analysisId))
        .limit(1);

      if (!analysis) {
        throw new Error(`Analysis ${analysisId} not found`);
      }

      if (analysis.status !== 'pending') {
        logger.warn(`Analysis ${analysisId} is not pending (status: ${analysis.status})`);
        return;
      }

      logger.info(`📝 Processing analysis ${analysisId}: ${analysis.originalFilename}`);

      // Update status to processing
      await db.update(sdeAnalyses)
        .set({
          status: 'processing',
          processingStartedAt: new Date()
        })
        .where(eq(sdeAnalyses.id, analysisId));

      const startTime = Date.now();

      // Step 1: Read the original file from storage (App Storage or filesystem fallback)
      const fileBuffer = await retrieveFile(analysis.originalFilePath, analysis.useFilesystemStorage || false);

      // Step 2: Write to temporary input file
      const tempDir = '/tmp';
      const tempInputPath = path.join(tempDir, `sde_input_${analysisId}_${Date.now()}.xlsx`);
      const tempOutputPath = path.join(tempDir, `sde_output_${analysisId}_${Date.now()}.xlsx`);

      await writeFileAsync(tempInputPath, fileBuffer);

      try {
        // Step 3: Use AI to analyze P&L (revenue, NOI, add-backs)
        const aiResult = await this.identifyAddBacksWithAI(tempInputPath);

        // Write AI results to JSON file for Python to use
        const analysisPath = tempInputPath.replace('.xlsx', '_ai_analysis.json');
        if (aiResult.revenue_row || aiResult.noi_row || aiResult.addbacks.length > 0) {
          const jsonContent = JSON.stringify(aiResult, null, 2);
          await writeFileAsync(analysisPath, jsonContent);
          logger.info(`Wrote AI analysis results to ${analysisPath}`);
        } else {
          logger.warn('No AI results - Python will use pattern-based detection');
        }

        // Step 4: Run Python analyzer
        await this.runPythonAnalyzer(
          tempInputPath,
          tempOutputPath,
          analysis.originalFilename.replace(/\.(xlsx|xls)$/i, '')
        );

        // Step 4: Read result file
        const resultBuffer = await readFileAsync(tempOutputPath);

        // Step 5: Store result (try App Storage, fall back to filesystem)
        const timestamp = Date.now();
        const resultFilename = analysis.originalFilename.replace(/\.(xlsx|xls)$/i, '_SDE.xlsx');
        const safeName = resultFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const resultStoragePath = `sde-results/user-${analysis.userId}/${timestamp}-${safeName}`;

        const storageResult = await storeFile(resultStoragePath, resultBuffer);

        if (!storageResult.success) {
          throw new Error('Failed to store result file');
        }

        // Step 6: Update database with success
        const processingTime = Math.round((Date.now() - startTime) / 1000);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

        await db.update(sdeAnalyses)
          .set({
            status: 'completed',
            completedAt: new Date(),
            expiresAt: expiresAt,
            resultFilename,
            resultFilePath: resultStoragePath,
            resultFileSize: resultBuffer.length,
            processingTimeSeconds: processingTime,
            useFilesystemStorage: storageResult.useFilesystem
          })
          .where(eq(sdeAnalyses.id, analysisId));

        logger.info(`Analysis ${analysisId} completed successfully in ${processingTime}s`);

      } finally {
        // Clean up temp files
        const analysisPath = tempInputPath.replace('.xlsx', '_ai_analysis.json');

        try {
          await unlinkAsync(tempInputPath);
        } catch (e) {
          logger.warn(`Failed to delete temp input file: ${e}`);
        }

        try {
          if (fs.existsSync(tempOutputPath)) {
            await unlinkAsync(tempOutputPath);
          }
        } catch (e) {
          logger.warn(`Failed to delete temp output file: ${e}`);
        }

        try {
          if (fs.existsSync(analysisPath)) {
            await unlinkAsync(analysisPath);
          }
        } catch (e) {
          logger.warn(`Failed to delete temp AI analysis file: ${e}`);
        }
      }

    } catch (error) {
      logger.error(`Error processing analysis ${analysisId}:`, error);

      // Update with error status
      await db.update(sdeAnalyses)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown processing error'
        })
        .where(eq(sdeAnalyses.id, analysisId));

      throw error;
    }
  }

  /**
   * Get rate limit for user based on subscription tier
   */
  getSdeAnalysisLimit(subscriptionStatus: string): number {
    switch (subscriptionStatus) {
      case 'free':
        return 0; // Locked for free users
      case 'starter':
      case 'starter_monthly':
        return 5; // 5 per month
      case 'pro':
      case 'pro_monthly':
      case 'standard': // legacy name
        return 15; // 15 per month
      case 'enterprise':
      case 'admin':
        return Infinity; // Unlimited
      default:
        return 0;
    }
  }
}

export const sdeAnalyzerService = new SDEAnalyzerService();
