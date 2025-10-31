# SDE Analyzer - Hybrid AI + Python Implementation

**Updated:** 2025-10-31
**Implementation:** OpenAI (add-back detection) + Python (processing & formatting)

---

## Overview

The SDE Analyzer now uses a **hybrid approach** combining the best of both worlds:

1. **OpenAI GPT-4o-mini** - Smart add-back identification (~$0.15 per million tokens)
2. **Python Script** - Fast structural processing and Excel formatting

### Why Hybrid?

- ✅ **Smart Detection**: AI identifies add-backs that pattern matching might miss
- ✅ **Low Cost**: OpenAI mini is ~100x cheaper than Anthropic
- ✅ **Fast Processing**: Python handles structural work efficiently
- ✅ **Graceful Degradation**: Falls back to pattern matching if OpenAI unavailable
- ✅ **Best of Both**: AI intelligence + Python reliability

---

## How It Works

### Processing Flow

```
1. User uploads Excel file
   ↓
2. Store in object storage + DB record (status: pending)
   ↓
3. Background Processing Starts:
   ├─ Read Excel file
   ├─ Extract first 200 rows
   ├─ Send to OpenAI GPT-4o-mini
   ├─ AI identifies add-backs (with row numbers)
   ├─ Write add-backs to JSON file
   ↓
4. Run Python Script:
   ├─ Check for AI add-backs JSON
   ├─ If found: Use AI-identified add-backs
   ├─ If not found: Fall back to pattern matching
   ├─ Generate formatted Excel with formulas
   ↓
5. Store result in object storage
   ↓
6. Update DB (status: completed)
   ↓
7. User downloads result
```

---

## AI Add-Back Detection

### What We Send to OpenAI

```
First 200 rows of P&L data formatted as:
Row 1: Account | Jan 2023 | Feb 2023 | ...
Row 2: Revenue | 50000 | 52000 | ...
Row 3: Cost of Goods | 20000 | 21000 | ...
...
```

### What We Get Back

```json
[
  {"row": 15, "label": "Depreciation Expense", "category": "depreciation"},
  {"row": 28, "label": "Owner Salary", "category": "owner_comp"},
  {"row": 42, "label": "Interest on Loan", "category": "interest"}
]
```

### AI Prompt

The AI is instructed to identify:
- Depreciation & Amortization
- Owner/Officer Compensation
- Interest Expense
- Payroll Taxes
- Insurance (health, life)
- Auto/Vehicle expenses
- Travel, Meals & Entertainment
- Legal & Professional Fees
- Bonuses
- Rent to owner
- Other discretionary expenses

**Important**: Only expenses ABOVE the Net Operating Income line.

---

## Cost Analysis

### Typical P&L File

- **Input Size**: 200 rows × 15 columns = ~3,000 tokens
- **Output Size**: 10 add-backs = ~200 tokens
- **Total**: ~3,200 tokens per analysis

### Pricing

**OpenAI GPT-4o-mini**:
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens

**Cost per analysis**:
- Input: 3,000 tokens × $0.15 / 1M = $0.00045
- Output: 200 tokens × $0.60 / 1M = $0.00012
- **Total: ~$0.0006 per analysis** (less than a penny!)

### Comparison

| Service | Cost per Analysis | Notes |
|---------|------------------|-------|
| OpenAI GPT-4o-mini | $0.0006 | Current implementation |
| Anthropic Claude Sonnet | $0.03 - $0.15 | 50-250x more expensive |
| Pattern matching only | $0 | Misses many add-backs |

---

## Environment Variables

### Required

```bash
# For basic functionality (pattern matching)
# None required!

# For AI-enhanced detection (recommended)
OPENAI_API_KEY=sk-...
```

### Behavior

- **With OpenAI key**: Uses AI for smart add-back detection
- **Without OpenAI key**: Falls back to pattern matching (still works!)

---

## Code Structure

### TypeScript Service (`server/sde-analyzer.ts`)

```typescript
class SDEAnalyzerService {
  // NEW: AI detection
  async identifyAddBacksWithAI(filePath: string): Promise<AddBack[]> {
    // 1. Read Excel with XLSX package
    // 2. Extract first 200 rows
    // 3. Call OpenAI GPT-4o-mini
    // 4. Parse JSON response
    // 5. Return add-backs with row numbers
  }

  // Process full analysis
  async processAnalysis(analysisId: number): Promise<void> {
    // 1. Download file from storage
    // 2. Call identifyAddBacksWithAI()
    // 3. Write add-backs to JSON file
    // 4. Run Python script
    // 5. Upload result to storage
  }
}
```

### Python Script (`sde_analyzer.py`)

```python
def detect_addbacks(self, df, structure):
    # NEW: Check for AI-generated JSON
    json_path = self.input_file.replace('.xlsx', '_addbacks.json')
    if os.path.exists(json_path):
        with open(json_path) as f:
            ai_addbacks = json.load(f)
        return convert_to_internal_format(ai_addbacks)

    # FALLBACK: Original pattern matching
    return pattern_based_detection(df, structure)
```

---

## File Flow

### Temporary Files

1. **Input File**: `/tmp/sde_input_{analysisId}_{timestamp}.xlsx`
2. **Add-backs JSON**: `/tmp/sde_input_{analysisId}_{timestamp}_addbacks.json` (if AI used)
3. **Output File**: `/tmp/sde_output_{analysisId}_{timestamp}.xlsx`

All cleaned up in `finally` block.

### JSON Format

```json
[
  {
    "row": 15,
    "label": "Depreciation Expense",
    "category": "depreciation"
  },
  {
    "row": 28,
    "label": "Owner Compensation",
    "category": "owner_comp"
  }
]
```

---

## Error Handling

### OpenAI Failures

If OpenAI call fails:
1. Log error
2. Return empty array `[]`
3. Python falls back to pattern matching
4. **Analysis still completes successfully**

### Python Failures

If Python fails:
1. Error logged to console
2. Database updated: `status: 'failed'`, `errorMessage: ...`
3. User sees error in analysis history

---

## Testing

### Test AI Detection Only

```typescript
// In Node.js console or test file
import { sdeAnalyzerService } from './server/sde-analyzer';

const addBacks = await sdeAnalyzerService.identifyAddBacksWithAI('test.xlsx');
console.log(addBacks);
```

### Test Full Flow

1. Upload a P&L file via UI
2. Check server logs:
   ```
   Reading Excel file for AI analysis...
   Sending to OpenAI for add-back identification...
   AI identified 8 add-backs
   Wrote 8 AI-identified add-backs to /tmp/sde_input_123_addbacks.json
   Running Python SDE analyzer...
   ✓ Using 8 AI-identified add-backs
   Python SDE analyzer completed successfully
   Analysis 123 completed successfully in 4s
   ```
3. Download and verify result

### Test Fallback (Without OpenAI)

1. Remove `OPENAI_API_KEY` from environment
2. Upload file
3. Check logs:
   ```
   OPENAI_API_KEY not set - AI-enhanced add-back detection will be skipped
   Running Python SDE analyzer...
   (Python uses pattern matching)
   ```

---

## Performance

### With AI Enhancement

- **AI Call**: 1-2 seconds
- **Python Processing**: 2-3 seconds
- **Total**: 3-5 seconds

### Without AI (Pattern Matching Only)

- **Python Processing**: 2-3 seconds
- **Total**: 2-3 seconds

---

## Monitoring & Debugging

### Key Log Messages

**Success flow**:
```
Reading Excel file for AI analysis...
Sending to OpenAI for add-back identification...
OpenAI response: [{"row":15,"label":"Depreciation",...}]
AI identified 8 add-backs
Wrote 8 AI-identified add-backs to /tmp/sde_input_123_addbacks.json
Running Python SDE analyzer: /tmp/sde_input_123.xlsx
✓ Using 8 AI-identified add-backs
Python SDE analyzer completed successfully
Analysis 123 completed successfully in 4s
```

**Fallback to pattern matching**:
```
OPENAI_API_KEY not set - AI-enhanced add-back detection will be skipped
Running Python SDE analyzer: /tmp/sde_input_123.xlsx
(No AI message - Python uses patterns)
Python SDE analyzer completed successfully
```

**AI error but still works**:
```
Error in AI add-back detection: <error>
Running Python SDE analyzer: /tmp/sde_input_123.xlsx
⚠ Failed to load AI add-backs: <error>, falling back to pattern matching
Python SDE analyzer completed successfully
```

---

## Advantages of This Approach

### vs Pure AI (Anthropic)

| Feature | Hybrid | Pure Anthropic |
|---------|--------|----------------|
| Cost | $0.0006 | $0.03-$0.15 |
| Speed | 3-5 sec | 10-30 sec |
| Reliability | High (has fallback) | Medium (API dependent) |
| Add-back Quality | Excellent | Excellent |
| Complexity | Low | High (beta APIs) |

### vs Pure Python

| Feature | Hybrid | Pure Python |
|---------|--------|-------------|
| Add-back Detection | Excellent | Good |
| Misses unusual items | Rare | Common |
| Cost | $0.0006 | $0 |
| Requires API key | Optional | No |
| Graceful degradation | Yes | N/A |

---

## Future Enhancements

### Possible Improvements

1. **Caching**: Cache AI results for similar files (same company)
2. **Batch Processing**: Process multiple analyses in one AI call
3. **User Feedback**: Allow users to correct AI add-backs
4. **Learning**: Fine-tune model based on user corrections
5. **Multiple AI Providers**: Add Claude as backup option
6. **Confidence Scores**: AI returns confidence for each add-back

### Cost Optimization

Current cost is already negligible ($0.0006), but could be further reduced:
- Use smaller context window (first 100 rows instead of 200)
- Batch multiple files in one API call
- Cache results for similar P&Ls

---

## Dependencies

### NPM Packages

```json
{
  "openai": "latest",
  "xlsx": "latest"
}
```

### Python Packages

```
pandas >= 2.0.0
openpyxl >= 3.1.0
```

---

## Troubleshooting

### "OpenAI API key not found"

**Symptom**: Log shows "OPENAI_API_KEY not set"

**Impact**: Analysis still works (uses pattern matching)

**Fix**: Add `OPENAI_API_KEY=sk-...` to environment/secrets

### "AI identified 0 add-backs"

**Possible causes**:
1. File format doesn't match P&L structure
2. No typical add-back expenses in file
3. All add-backs below NOI line

**Check**: Look at Python output - it should still find some via patterns

### "Failed to parse JSON from OpenAI"

**Symptom**: Error parsing AI response

**Impact**: Falls back to pattern matching

**Fix**: Usually transient - retry works. If persistent, check OpenAI status.

---

## Migration Notes

### From Pure Python Implementation

**Added**:
- OpenAI SDK and XLSX package
- `identifyAddBacksWithAI()` method
- JSON file creation for AI add-backs
- Modified Python script to check for JSON

**Removed**:
- Nothing! This is purely additive

**Breaking Changes**:
- None - works with or without OpenAI key

### From Anthropic Implementation

**Removed**:
- Anthropic SDK
- Files API upload/download
- Skills container configuration
- Beta endpoint complexity

**Added**:
- OpenAI SDK (much simpler)
- XLSX package for reading Excel
- Hybrid detection logic

---

## Best Practices

### Production Deployment

1. **Set OpenAI Key**: Add to environment for best results
2. **Monitor Costs**: Track OpenAI usage (should be negligible)
3. **Log Analysis**: Keep logs of AI detection quality
4. **User Feedback**: Collect feedback on add-back accuracy
5. **Fallback Testing**: Periodically test without AI to ensure fallback works

### Development

1. **Use OpenAI Key**: Always test with AI enabled
2. **Check Logs**: Verify AI is being called
3. **Test Edge Cases**: Files with no add-backs, unusual formats
4. **Compare Results**: AI vs pattern matching quality

---

## Support

For issues:

1. Check server logs for AI/Python errors
2. Verify OpenAI key is set (optional but recommended)
3. Test file manually with Python script
4. Review OpenAI response in logs

---

## Version History

### 2025-10-31 - Hybrid Implementation

- ✅ Added OpenAI GPT-4o-mini for add-back detection
- ✅ Installed OpenAI SDK and XLSX package
- ✅ Created AI detection method with smart prompting
- ✅ Modified Python script to use AI add-backs
- ✅ Graceful fallback to pattern matching
- ✅ Cost: ~$0.0006 per analysis (negligible)
- ✅ Processing time: 3-5 seconds total

---

## License

MIT License - Free for commercial and personal use
